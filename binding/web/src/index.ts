import { Eagle, EagleProfiler } from './eagle';
import { EagleProfilerWorker } from './eagle_profiler_worker';
import { EagleWorker } from './eagle_worker';

import {
  EagleModel,
  EagleProfile,
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
  EagleWorkerInitRequest,
  EagleWorkerProcessRequest,
  EagleWorkerResetRequest,
  EagleWorkerReleaseRequest,
  EagleWorkerRequest,
  EagleWorkerInitResponse,
  EagleWorkerProcessResponse,
  EagleWorkerResetResponse,
  EagleWorkerReleaseResponse,
  EagleWorkerResponse,
} from './types';

import eagleWasm from '../lib/pv_eagle.wasm';
import eagleWasmSimd from '../lib/pv_eagle_simd.wasm';

Eagle.setWasm(eagleWasm);
Eagle.setWasmSimd(eagleWasmSimd);
EagleWorker.setWasm(eagleWasm);
EagleWorker.setWasmSimd(eagleWasmSimd);
EagleProfiler.setWasm(eagleWasm);
EagleProfiler.setWasmSimd(eagleWasmSimd);
EagleProfilerWorker.setWasm(eagleWasm);
EagleProfilerWorker.setWasmSimd(eagleWasmSimd);

export {
  Eagle,
  EagleModel,
  EagleProfile,
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
  EagleWorker,
  EagleWorkerInitRequest,
  EagleWorkerProcessRequest,
  EagleWorkerResetRequest,
  EagleWorkerReleaseRequest,
  EagleWorkerRequest,
  EagleWorkerInitResponse,
  EagleWorkerProcessResponse,
  EagleWorkerResetResponse,
  EagleWorkerReleaseResponse,
  EagleWorkerResponse,
};
