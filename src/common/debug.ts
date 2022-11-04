import { padNumber } from "../util";
import { Chunk } from "./chunk";
import { OpCode } from "./opcode";
import { RueClosure, RueValue } from "./value";

export const InstructionTable: {
	[index in OpCode]: [string, (name: string, chunk: Chunk, offset: number) => [number, string]];
} = {
	[OpCode.NIL]: ["NIL", simpleInstruction],
	[OpCode.TRUE]: ["TRUE", simpleInstruction],
	[OpCode.FALSE]: ["FALSE", simpleInstruction],
	[OpCode.CONSTANT]: ["CONSTANT", constantInstruction],
	[OpCode.CLOSURE]: ["CLOSURE", closureInstruction],
	[OpCode.USE]: ["USE", simpleInstruction],
	[OpCode.NOT]: ["NOT", simpleInstruction],
	[OpCode.NEGATE]: ["NEGATE", simpleInstruction],
	[OpCode.ADD]: ["ADD", simpleInstruction],
	[OpCode.SUBTRACT]: ["SUBTRACT", simpleInstruction],
	[OpCode.MULTIPLY]: ["MULTIPLY", simpleInstruction],
	[OpCode.DIVIDE]: ["DIVIDE", simpleInstruction],
	[OpCode.EQUAL]: ["EQUAL", simpleInstruction],
	[OpCode.GREATER]: ["GREATER", simpleInstruction],
	[OpCode.LESS]: ["LESS", simpleInstruction],
	[OpCode.JUMP_IF_FALSE]: ["JUMP_IF_FALSE", jumpInstruction],
	[OpCode.JUMP]: ["JUMP", jumpInstruction],
	[OpCode.LOOP]: ["LOOP", jumpInstruction],
	[OpCode.DEFINE_GLOBAL]: ["DEFINE_GLOBAL", constantInstruction],
	[OpCode.GET_GLOBAL]: ["GET_GLOBAL", constantInstruction],
	[OpCode.SET_GLOBAL]: ["SET_GLOBAL", constantInstruction],
	[OpCode.GET_LOCAL]: ["GET_LOCAL", byteInstruction],
	[OpCode.SET_LOCAL]: ["SET_LOCAL", byteInstruction],
	[OpCode.GET_UPVALUE]: ["GET_UPVALUE", byteInstruction],
	[OpCode.SET_UPVALUE]: ["SET_UPVALUE", byteInstruction],
	[OpCode.GET_FIELD]: ["GET_FIELD", constantInstruction],
	[OpCode.SET_FIELD]: ["SET_FIELD", constantInstruction],
	[OpCode.RETURN]: ["RETURN", simpleInstruction],
	[OpCode.CALL]: ["CALL", byteInstruction],
	[OpCode.POP]: ["POP", simpleInstruction],
};

function printValue(val: RueValue) {
	if (!val) {
		print("BRUH");
		return "";
	}

	let text = `[ ${val.type}`;

	if (val.type !== "nil") {
		text += ` : ${val.value}`;
	}

	text += " ]";

	return text;
}

function simpleInstruction(name: string, _chunk: Chunk, offset: number): [number, string] {
	return [offset + 1, name];
}

function constantInstruction(name: string, chunk: Chunk, offset: number): [number, string] {
	const constant = chunk.code[offset + 1];
	return [offset + 2, `${name} ${padNumber(constant, 4)} ${printValue(chunk.constants[constant])}`];
}

function byteInstruction(name: string, chunk: Chunk, offset: number): [number, string] {
	const slot = chunk.code[offset + 1];
	return [offset + 2, `${name} ${padNumber(slot, 4)}`];
}

function jumpInstruction(name: string, chunk: Chunk, offset: number, direction = 1): [number, string] {
	const jmpOffset = chunk.code[offset + 1];
	return [offset + 2, `${name} ${padNumber(offset + jmpOffset * direction, 4)}`];
}

function closureInstruction(name: string, chunk: Chunk, offset: number): [number, string] {
	let coffset = offset;
	let str = name + " fn: ";

	const fn = chunk.constants[chunk.code[++coffset]] as RueClosure;
	str += fn.value.fn.value.name + " upvalues: [ ";

	for (let i = 0; i < fn.value.fn.value.upvalueCount; i++) {
		const isLocal = chunk.code[++coffset];
		const index = chunk.code[++coffset];
		str += `[ local: ${isLocal === 1 ? true : false}, index: ${index} ]`;
	}

	str += " ]";
	return [++coffset, str];
}

export namespace Debug {
	export const Config = {
		DEBUG_TRACE_EXECUTION: true,
		DEBUG_EXECUTION_TIME: true,
		DEBUG_STACK: false,
	};

	export function DisassembleInstruction(chunk: Chunk, offset: number): [number, string] {
		const instruction = chunk.code[offset] as OpCode;
		const name = InstructionTable[instruction][0];
		return InstructionTable[instruction][1](name, chunk, offset);
	}

	export function DisassembleChunk(chunk: Chunk, name: string) {
		print(`=== ${name} ===`);
		for (let offset = 0; offset < chunk.code.size(); offset) {
			const [newOffset, log] = DisassembleInstruction(chunk, offset);
			print(
				`${padNumber(offset, 4)} ${
					chunk.lines[offset] === chunk.lines[offset - 1] ? "|" : chunk.lines[offset]
				}  ${log}`,
			);

			offset = newOffset;
		}
	}
}
