import ScheduleVersion from '../models/ScheduleVersion.js';
import { compareVersions as compareVersionsService, rollbackToVersion as rollbackService } from '../services/versionService.js';
import { simulateCancellation as simulateCancellationService } from '../services/replanningService.js';

export async function getVersions(req, res, next) {
  try {
    const versions = await ScheduleVersion.find({}).sort({ versionNumber: -1 });
    res.json({ success: true, count: versions.length, data: versions });
  } catch (error) {
    next(error);
  }
}

export async function getVersionById(req, res, next) {
  try {
    const { versionId } = req.params;
    const version = await ScheduleVersion.findOne({
      $or: [{ versionId }, { version: versionId }],
    });

    if (!version) {
      return res.status(404).json({ success: false, message: `Version ${versionId} not found.`, code: 'NOT_FOUND' });
    }

    res.json({ success: true, data: version });
  } catch (error) {
    next(error);
  }
}

export async function compareVersions(req, res, next) {
  try {
    const { from, to } = req.params;
    const fromVer = await ScheduleVersion.findOne({
      $or: [{ versionId: from }, { version: from }],
    });
    const toVer = await ScheduleVersion.findOne({
      $or: [{ versionId: to }, { version: to }],
    });

    if (!fromVer || !toVer) {
      return res.status(404).json({
        success: false,
        message: `One or both versions (${from}, ${to}) not found for comparison.`,
        code: 'NOT_FOUND',
      });
    }

    const diff = compareVersionsService(fromVer, toVer);
    res.json({ success: true, data: diff });
  } catch (error) {
    next(error);
  }
}

export async function rollbackVersion(req, res, next) {
  try {
    const { versionId } = req.params;
    const { performedBy = 'Dispatcher' } = req.body;

    const newVersion = await rollbackService(versionId, performedBy);

    res.json({
      success: true,
      version: newVersion.version,
      versionLabel: newVersion.version,
      data: newVersion,
      message: `Rollback successful: Restored ${versionId} snapshot into new draft version ${newVersion.version}.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function simulateCancellation(req, res, next) {
  try {
    const { technicianId, assignmentId, requestId } = req.body;

    const result = await simulateCancellationService({ technicianId, assignmentId, requestId });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
