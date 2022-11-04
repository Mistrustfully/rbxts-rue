import { Chunk } from "./chunk";

export type RueString = {
	type: "string";
	value: string;
};

export type RueNumber = {
	type: "number";
	value: number;
};

export type RueBoolean = {
	type: "boolean";
	value: boolean;
};

export type RueNil = {
	type: "nil";
};

export type RueObject = {
	type: "object";
	value: { [index: string]: RueValue };
};

export type RueFunction = {
	type: "function";
	value: { chunk: Chunk; name: string; arity: number; upvalueCount: number };
};

export type RueClosure = {
	type: "closure";
	value: { fn: RueFunction; upvalues: RueUpvalue[] };
};

export type RueUpvalue = {
	type: "upvalue";
	value: { isLocal: boolean; index: number; value: RueValue; next?: RueUpvalue };
};

export type RueNative = {
	type: "nativeFunction";
	value: (...args: RueValue[]) => RueValue;
};

export type RueError = {
	type: "error";
	value: string;
};

export type RueValue =
	| RueString
	| RueNumber
	| RueBoolean
	| RueNil
	| RueObject
	| RueFunction
	| RueClosure
	| RueNative
	| RueError;

export function ValuesEqual(a: RueValue, b: RueValue) {
	if (a.type !== b.type) return false;
	if (a.type === "nil" || b.type === "nil") return true;

	return a.value === b.value;
}
