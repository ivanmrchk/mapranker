import type { Pin } from '@prisma/client';
import { prisma } from '../prisma.js';
import {
  RankEngineBlockedError,
  type RankCheckInput,
  type RankCheckResult,
  type RankEngine,
} from '../rank/engine.js';
import {
  RunError,
  checkablePinsWhere,
  finishRun,
  latestRunOrNew,
  loadKeyword,
  recomputeRun,
  refreshStatsAfterCheck,
  savePinResult,
} from './runs.js';

type Keyword = Awaited<ReturnType<typeof loadKeyword>>;

const STOPPED_BY_USER = 'Stopped by you.';
const STOPPED_BY_CAPTCHA =
  'Google asked for a CAPTCHA, so the run stopped. The unchecked pins can be run again later.';

/**
 * Sends rank checks to the engine, one job at a time: a full run (checked in the
 * background, progress saved pin by pin) or a single-pin check. Only one job runs at once
 * because they all search from the same IP address, and parallel searches invite CAPTCHAs.
 */
export class RunManager {
  private busyWith: 'run' | 'pin' | null = null;
  private activeRun: { id: string; stopRequested: boolean } | null = null;

  constructor(private readonly engine: RankEngine) {}

  /** Creates a run and starts checking its pins in the background; returns the run id at once. */
  async startRun(projectId: string, keywordId: string): Promise<string> {
    this.claimEngine('run');
    try {
      const keyword = await loadKeyword(projectId, keywordId);
      // Top row first, left to right, so the map fills in like reading a page.
      const pins = await prisma.pin.findMany({
        where: checkablePinsWhere(projectId),
        orderBy: [{ lat: 'desc' }, { lng: 'asc' }],
      });
      if (pins.length === 0) throw new RunError('This project has no enabled pins to check.', 400);

      const run = await prisma.keywordRun.create({
        data: { keywordId, date: new Date(), pinsTotal: pins.length, pinsChecked: 0, status: 'Running' },
      });
      this.activeRun = { id: run.id, stopRequested: false };
      void this.checkAllPins(run.id, keyword, pins).finally(() => {
        this.activeRun = null;
        this.releaseEngine();
      });
      return run.id;
    } catch (err) {
      this.releaseEngine();
      throw err;
    }
  }

  /** Asks the active run to stop after the pin it's checking now. */
  requestStop(runId: string) {
    if (this.activeRun?.id !== runId) throw new RunError('That run is not running.', 409);
    this.activeRun.stopRequested = true;
  }

  /**
   * Checks one pin now. The result replaces that pin's result in the keyword's latest run
   * (creating a run if the keyword has none), then stats are recalculated.
   */
  async checkPin(projectId: string, keywordId: string, pinId: string): Promise<string> {
    this.claimEngine('pin');
    try {
      const keyword = await loadKeyword(projectId, keywordId);
      const pin = await prisma.pin.findFirst({ where: { id: pinId, projectId, deletedAt: null } });
      if (!pin) throw new RunError('Pin not found', 404);
      if (!pin.enabled) throw new RunError('Pin is disabled', 400);

      const result = await this.checkOnePin(checkInput(keyword, pin));
      const run = await latestRunOrNew(projectId, keywordId);
      await savePinResult({ runId: run.id, pinId, result });
      await refreshStatsAfterCheck({ runId: run.id, keywordId, projectId });
      return run.id;
    } finally {
      this.releaseEngine();
    }
  }

  private async checkOnePin(input: RankCheckInput): Promise<RankCheckResult> {
    try {
      const session = await this.engine.startSession();
      try {
        return await session.check(input);
      } finally {
        await session.close();
      }
    } catch (err) {
      if (err instanceof RankEngineBlockedError) {
        throw new RunError('Google asked for a CAPTCHA. Try again later.', 503);
      }
      throw new RunError(`Check failed: ${(err as Error).message}`, 502);
    }
  }

  /** Never throws: whatever happens, the run ends up Completed or Stopped with a reason. */
  private async checkAllPins(runId: string, keyword: Keyword, pins: Pin[]) {
    let stopReason: string | null = null;
    try {
      const session = await this.engine.startSession();
      try {
        for (const pin of pins) {
          if (this.activeRun?.stopRequested) {
            stopReason = STOPPED_BY_USER;
            break;
          }
          try {
            const result = await session.check(checkInput(keyword, pin));
            await savePinResult({ runId, pinId: pin.id, result });
            // Keeps the run's numbers current so the page shows them while it's running.
            await recomputeRun(runId);
          } catch (err) {
            if (err instanceof RankEngineBlockedError) {
              stopReason = STOPPED_BY_CAPTCHA;
              break;
            }
            // A failed check leaves this pin unchecked for the run; the others still count.
            console.warn(`Check failed for pin ${pin.id} (${keyword.text}):`, (err as Error).message);
          }
        }
      } finally {
        await session.close();
      }
    } catch (err) {
      stopReason = `The run failed: ${(err as Error).message}`;
      console.error(`Run ${runId} failed:`, err);
    }

    try {
      await finishRun({ runId, stopReason });
    } catch (err) {
      console.error(`Couldn't finish run ${runId}:`, err);
    }
  }

  private claimEngine(job: 'run' | 'pin') {
    if (this.busyWith === 'run') {
      throw new RunError('A run is in progress. Wait for it to finish, or stop it first.', 409);
    }
    if (this.busyWith === 'pin') throw new RunError('Another pin check is in progress.', 409);
    this.busyWith = job;
  }

  private releaseEngine() {
    this.busyWith = null;
  }
}

function checkInput(keyword: Keyword, pin: Pin): RankCheckInput {
  return {
    keyword: keyword.text,
    lat: pin.lat,
    lng: pin.lng,
    placeId: keyword.project.placeId,
    businessName: keyword.project.businessLabel,
  };
}
