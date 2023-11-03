import { Eagle, EagleProfiler } from './eagle';
import { EagleProfilerWorker } from './eagle_profiler_worker';
import { EagleWorker } from './eagle_worker';
import * as EagleErrors from './eagle_errors';

import {
  EagleModel,
  EagleProfile,
  EagleProfilerEnrollFeedback,
  EagleProfilerEnrollResult,
  EagleProfilerWorkerEnrollRequest,
  EagleProfilerWorkerEnrollResponse,
  EagleProfilerWorkerExportRequest,
  EagleProfilerWorkerExportResponse,
  EagleProfilerWorkerFailureResponse,
  EagleProfilerWorkerInitRequest,
  EagleProfilerWorkerInitResponse,
  EagleProfilerWorkerReleaseRequest,
  EagleProfilerWorkerReleaseResponse,
  EagleProfilerWorkerRequest,
  EagleProfilerWorkerResetRequest,
  EagleProfilerWorkerResetResponse,
  EagleProfilerWorkerResponse,
  EagleWorkerFailureResponse,
  EagleWorkerInitRequest,
  EagleWorkerInitResponse,
  EagleWorkerProcessRequest,
  EagleWorkerProcessResponse,
  EagleWorkerReleaseRequest,
  EagleWorkerReleaseResponse,
  EagleWorkerRequest,
  EagleWorkerResetRequest,
  EagleWorkerResetResponse,
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
  EagleErrors,
  EagleModel,
  EagleProfile,
  EagleProfiler,
  EagleProfilerEnrollFeedback,
  EagleProfilerEnrollResult,
  EagleProfilerWorker,
  EagleProfilerWorkerEnrollRequest,
  EagleProfilerWorkerEnrollResponse,
  EagleProfilerWorkerExportRequest,
  EagleProfilerWorkerExportResponse,
  EagleProfilerWorkerFailureResponse,
  EagleProfilerWorkerInitRequest,
  EagleProfilerWorkerInitResponse,
  EagleProfilerWorkerReleaseRequest,
  EagleProfilerWorkerReleaseResponse,
  EagleProfilerWorkerRequest,
  EagleProfilerWorkerResetRequest,
  EagleProfilerWorkerResetResponse,
  EagleProfilerWorkerResponse,
  EagleWorker,
  EagleWorkerFailureResponse,
  EagleWorkerInitRequest,
  EagleWorkerInitResponse,
  EagleWorkerProcessRequest,
  EagleWorkerProcessResponse,
  EagleWorkerReleaseRequest,
  EagleWorkerReleaseResponse,
  EagleWorkerRequest,
  EagleWorkerResetRequest,
  EagleWorkerResetResponse,
  EagleWorkerResponse,
};
