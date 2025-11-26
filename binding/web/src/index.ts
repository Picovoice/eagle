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

import eagleWasmSimd from './lib/pv_eagle_simd.wasm';
import eagleWasmSimdLib from './lib/pv_eagle_simd.txt';
import eagleWasmPThread from './lib/pv_eagle_pthread.wasm';
import eagleWasmPThreadLib from './lib/pv_eagle_pthread.txt';

Eagle.setWasmSimd(eagleWasmSimd);
Eagle.setWasmSimdLib(eagleWasmSimdLib);
Eagle.setWasmPThread(eagleWasmPThread);
Eagle.setWasmPThreadLib(eagleWasmPThreadLib);
EagleWorker.setWasmSimd(eagleWasmSimd);
EagleWorker.setWasmSimdLib(eagleWasmSimdLib);
EagleWorker.setWasmPThread(eagleWasmPThread);
EagleWorker.setWasmPThreadLib(eagleWasmPThreadLib);

EagleProfiler.setWasmSimd(eagleWasmSimd);
EagleProfiler.setWasmSimdLib(eagleWasmSimdLib);
EagleProfiler.setWasmPThread(eagleWasmPThread);
EagleProfiler.setWasmPThreadLib(eagleWasmPThreadLib);
EagleProfilerWorker.setWasmSimd(eagleWasmSimd);
EagleProfilerWorker.setWasmSimdLib(eagleWasmSimdLib);
EagleProfilerWorker.setWasmPThread(eagleWasmPThread);
EagleProfilerWorker.setWasmPThreadLib(eagleWasmPThreadLib);

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
