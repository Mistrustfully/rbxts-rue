import { RueValue } from "./value";

export class Chunk {
	public code: number[] = [];
	public lines: number[] = [];

	public constants: RueValue[] = [];
	public stack: RueValue[] = [];

	write(byte: number, line: number) {
		this.code.push(byte);
		this.lines.push(line);
	}

	addConstant(value: RueValue) {
		this.constants.push(value);
		return this.constants.size() - 1;
	}
}
