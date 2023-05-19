import { Eagle, EagleProfiler } from './eagle';
import { EagleProfilerWorker } from './eagle_worker';

import {
  EagleModel,
  EagleProfilerEnrollFeedback,
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

Eagle.setWasm(eagleWasm);
Eagle.setWasmSimd(eagleWasmSimd);
EagleProfiler.setWasm(eagleWasm);
EagleProfiler.setWasmSimd(eagleWasmSimd);
EagleProfilerWorker.setWasm(eagleWasm);
EagleProfilerWorker.setWasmSimd(eagleWasmSimd);

export {
  Eagle,
  EagleModel,
  EagleProfiler,
  EagleProfilerEnrollFeedback,
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
