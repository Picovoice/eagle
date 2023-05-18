import { EagleProfiler } from './eagle';
import { EagleProfilerWorker } from './eagle_worker';

import {
  EagleModel,
  EagleProfile,
  EagleProfilerEnrollFeedback,
  EagleProfilerOptions,
  EagleProfilerWorkerInitRequest,
  EagleProfilerWorkerEnrollRequest,
  EagleProfilerWorkerExportRequest,
  EagleProfilerWorkerResetRequest,
  EagleProfilerWorkerReleaseRequest,
  EagleProfilerWorkerRequest,
  EagleProfilerWorkerInitResponse,
  EagleProfilerWorkerEnrollResponse,
  EagleProfilerWorkerExportResponse,
  EagleProfilerWorkerResetResponse,
  EagleProfilerWorkerReleaseResponse,
  EagleProfilerWorkerResponse,
} from './types';

import eagleWasm from '../lib/pv_eagle.wasm';
import eagleWasmSimd from '../lib/pv_eagle_simd.wasm';

EagleProfiler.setWasm(eagleWasm);
EagleProfiler.setWasmSimd(eagleWasmSimd);
EagleProfilerWorker.setWasm(eagleWasm);
EagleProfilerWorker.setWasmSimd(eagleWasmSimd);

export {
  EagleModel,
  EagleProfile,
  EagleProfiler,
  EagleProfilerEnrollFeedback,
  EagleProfilerOptions,
  EagleProfilerWorker,
  EagleProfilerWorkerInitRequest,
  EagleProfilerWorkerEnrollRequest,
  EagleProfilerWorkerExportRequest,
  EagleProfilerWorkerResetRequest,
  EagleProfilerWorkerReleaseRequest,
  EagleProfilerWorkerRequest,
  EagleProfilerWorkerInitResponse,
  EagleProfilerWorkerEnrollResponse,
  EagleProfilerWorkerExportResponse,
  EagleProfilerWorkerResetResponse,
  EagleProfilerWorkerReleaseResponse,
  EagleProfilerWorkerResponse,
};
