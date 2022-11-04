import { OpCode } from "../common/opcode";
import { TokenType } from "../common/token";
import { stringToDigit } from "../util";
import { Compiler } from "./compiler";

export type ParseFn = (compiler: Compiler, canAssign: boolean) => void;
export const DefaultRule = [Precendence.NONE];

export const enum Precendence {
	NONE,
	ASSIGNMENT,
	OR,
	AND,
	EQUALITY,
	COMPARISON,
	TERM,
	FACTOR,
	UNARY,
	CALL,
	PRIMARY,
}

export const rules: { [index in number]: [Precendence, ParseFn?, ParseFn?] } = {
	[TokenType.LEFT_PAREN]: [Precendence.CALL, grouping, call],
	[TokenType.DOT]: [Precendence.CALL, undefined, dot],
	[TokenType.LEFT_BRACE]: [Precendence.NONE, object, undefined],
	[TokenType.MINUS]: [Precendence.TERM, unary, binary],
	[TokenType.PLUS]: [Precendence.TERM, undefined, binary],
	[TokenType.SLASH]: [Precendence.FACTOR, undefined, binary],
	[TokenType.STAR]: [Precendence.FACTOR, undefined, binary],
	[TokenType.NUMBER]: [Precendence.NONE, number, undefined],

	[TokenType.NIL]: [Precendence.NONE, literal],
	[TokenType.FALSE]: [Precendence.NONE, literal],
	[TokenType.TRUE]: [Precendence.NONE, literal],

	[TokenType.BANG]: [Precendence.NONE, unary],
	[TokenType.BANG_EQUAL]: [Precendence.EQUALITY, undefined, binary],
	[TokenType.EQUAL_EQUAL]: [Precendence.EQUALITY, undefined, binary],
	[TokenType.GREATER]: [Precendence.EQUALITY, undefined, binary],
	[TokenType.GREATER_EQUAL]: [Precendence.EQUALITY, undefined, binary],
	[TokenType.LESS]: [Precendence.EQUALITY, undefined, binary],
	[TokenType.LESS_EQUAL]: [Precendence.EQUALITY, undefined, binary],

	[TokenType.STRING]: [Precendence.NONE, string_],
	[TokenType.IDENTIFIER]: [Precendence.NONE, variable],

	[TokenType.AND]: [Precendence.AND, undefined, and_],
	[TokenType.OR]: [Precendence.OR, undefined, or_],
};

export function object(compiler: Compiler) {
	compiler.object();
}

export function grouping(compiler: Compiler) {
	compiler.expression();
	compiler.consume(TokenType.RIGHT_PAREN, "Expect ')' after expression");
}

export function call(compiler: Compiler) {
	const argCount = compiler.argumentList();
	compiler.emitBytes(OpCode.CALL, argCount);
}

export function dot(compiler: Compiler, canAssign: boolean) {
	compiler.consume(TokenType.IDENTIFIER, "Expect property name after '.'");
	const name = compiler.identifierConstant(compiler.parser.previous);

	if (canAssign && compiler.match(TokenType.EQUAL)) {
		compiler.expression();
		compiler.emitBytes(OpCode.SET_FIELD, name);
	} else {
		compiler.emitBytes(OpCode.GET_FIELD, name);
	}
}

export function binary(compiler: Compiler) {
	const operatorType = compiler.parser.previous.type;
	const rule = compiler.getRule(operatorType);
	compiler.parsePrecedence(rule[0]);

	switch (operatorType) {
		case TokenType.PLUS:
			compiler.emitByte(OpCode.ADD);
			break;
		case TokenType.MINUS:
			compiler.emitByte(OpCode.SUBTRACT);
			break;
		case TokenType.STAR:
			compiler.emitByte(OpCode.MULTIPLY);
			break;
		case TokenType.SLASH:
			compiler.emitByte(OpCode.DIVIDE);
			break;
		case TokenType.BANG_EQUAL:
			compiler.emitBytes(OpCode.EQUAL, OpCode.NOT);
			break;
		case TokenType.EQUAL_EQUAL:
			compiler.emitBytes(OpCode.EQUAL);
			break;
		case TokenType.GREATER:
			compiler.emitByte(OpCode.GREATER);
			break;
		case TokenType.GREATER_EQUAL:
			compiler.emitBytes(OpCode.LESS, OpCode.NOT);
			break;
		case TokenType.LESS:
			compiler.emitByte(OpCode.LESS);
			break;
		case TokenType.LESS_EQUAL:
			compiler.emitBytes(OpCode.GREATER, OpCode.NOT);
			break;
	}
}

export function number(compiler: Compiler) {
	const number = stringToDigit(compiler.parser.previous.lexeme);
	compiler.emitConstant({ type: "number", value: number! });
}

export function unary(compiler: Compiler) {
	const operatorType = compiler.parser.previous.type;
	compiler.parsePrecedence(Precendence.UNARY);

	switch (operatorType) {
		case TokenType.MINUS:
			compiler.emitByte(OpCode.NEGATE);
			break;
		case TokenType.BANG:
			compiler.emitByte(OpCode.NOT);
			break;
	}
}

export function literal(compiler: Compiler) {
	switch (compiler.parser.previous.type) {
		case TokenType.FALSE:
			compiler.emitByte(OpCode.FALSE);
			break;
		case TokenType.TRUE:
			compiler.emitByte(OpCode.TRUE);
			break;
		case TokenType.NIL:
			compiler.emitByte(OpCode.NIL);
			break;
	}
}

export function string_(compiler: Compiler) {
	compiler.emitConstant({
		type: "string",
		value: compiler.parser.previous.lexeme.sub(1, compiler.parser.previous.lexeme.size() - 1),
	});
}

export function and_(compiler: Compiler) {
	const endJump = compiler.emitJump(OpCode.JUMP_IF_FALSE);
	compiler.emitByte(OpCode.POP);
	compiler.parsePrecedence(Precendence.AND);
	compiler.patchJump(endJump);
}

export function or_(compiler: Compiler) {
	const elseJump = compiler.emitJump(OpCode.JUMP_IF_FALSE);
	const endJump = compiler.emitJump(OpCode.JUMP);

	compiler.patchJump(elseJump);
	compiler.emitByte(OpCode.POP);

	compiler.parsePrecedence(Precendence.OR);
	compiler.patchJump(endJump);
}

export function variable(compiler: Compiler, canAssign: boolean) {
	compiler.namedVariable(compiler.parser.previous, canAssign);
}
