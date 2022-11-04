import { Debug as DebugCommon } from "./common/debug";
import { VM as VM_ } from "./backend/vm";
import std_ from "./std";

namespace Rue {
	export const Debug = DebugCommon;
	export const VM = VM_;
	export const std = std_;
}

export = Rue;
