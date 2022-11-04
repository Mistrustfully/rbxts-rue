import { Chunk } from "../common/chunk";
import { Debug } from "../common/debug";
import { OpCode } from "../common/opcode";
import { Token, TokenType } from "../common/token";
import { RueFunction, RueUpvalue, RueValue } from "../common/value";
import { Parser } from "./parser";
import { DefaultRule, ParseFn, Precendence, rules } from "./precendence";
import { Scanner } from "./scanner";

type RueLocal = { name: string; depth: number; isCaptured: boolean };
export enum FunctionType {
	FUNCTION,
	SCRIPT,
}

export function Compile(source: string, libraries: Map<string, RueValue>): [boolean, RueFunction] {
	const scanner = new Scanner(source);
	const parser = new Parser(scanner);

	const compiler = new Compiler(
		{ type: "function", value: { arity: 0, upvalueCount: 0, name: "main", chunk: new Chunk() } },
		FunctionType.SCRIPT,
		parser,
		libraries,
	);

	compiler.advance();

	while (!compiler.match(TokenType.EOF)) {
		compiler.declaration();
	}

	compiler.endCompiler();
	const fn = compiler.function;

	// Insert return statements if missing.
	if (fn.value.chunk.code[fn.value.chunk.code.size() - 2] !== OpCode.RETURN) {
		fn.value.chunk.write(OpCode.NIL, parser.current.line);
		fn.value.chunk.write(OpCode.RETURN, parser.current.line);
	}

	return [!parser.hadError, fn];
}

export class Compiler {
	function: RueFunction;
	enclosing?: Compiler;
	type: FunctionType;

	upvalues: RueUpvalue[] = [];
	locals: RueLocal[] = [];
	localCount = 0;
	scopeDepth = 0;

	currentChunk() {
		return this.function.value.chunk;
	}

	errorAt(token: Token, message: string) {
		if (this.parser.panicMode) return;

		let text = `[line ${token.line}] Error `;
		if (token.type === TokenType.EOF) {
			text += "at end";
		} else if (token.type !== TokenType.ERROR) {
			text += token.lexeme;
		}

		print(`${text} ${message}`);
		this.parser.hadError = true;
		this.parser.panicMode = true;
	}

	match(type_: TokenType) {
		if (this.parser.current.type !== type_) return false;
		this.advance();
		return true;
	}

	consume(type_: TokenType, message: string) {
		if (this.parser.current.type === type_) {
			this.advance();
			return;
		}

		this.errorAt(this.parser.current, message);
	}

	/// Emit Functions

	emitByte(byte: number) {
		this.currentChunk().write(byte, this.parser.previous.line);
	}

	emitBytes(...bytes: number[]) {
		bytes.forEach((byte) => this.emitByte(byte));
	}

	makeConstant(constant: RueValue) {
		return this.currentChunk().addConstant(constant);
	}

	emitConstant(constant: RueValue) {
		this.emitBytes(OpCode.CONSTANT, this.makeConstant(constant));
	}

	emitJump(instruction: OpCode) {
		this.emitByte(instruction);
		this.emitByte(0);
		return this.currentChunk().code.size() - 1;
	}

	patchJump(offset: number) {
		const jump = this.currentChunk().code.size();
		this.currentChunk().code[offset] = jump - offset - 1;
	}

	emitLoop(loopStart: number) {
		this.emitByte(OpCode.LOOP);

		const offset = this.currentChunk().code.size() - loopStart + 1;
		this.emitByte(offset);
	}

	/// Parse Functions

	getRule(type_: TokenType) {
		return rules[type_] || DefaultRule;
	}

	parsePrecedence(precedence: Precendence) {
		this.advance();
		const prefixRule = this.getRule(this.parser.previous.type)[1] as ParseFn;
		if (!prefixRule) {
			this.errorAt(this.parser.previous, "Expect expression.");
			return;
		}

		const canAssign = precedence <= Precendence.ASSIGNMENT;
		prefixRule(this, canAssign);

		while (precedence <= this.getRule(this.parser.current.type)[0]) {
			this.advance();
			const infix = this.getRule(this.parser.previous.type)[2] as ParseFn;
			if (infix) {
				infix(this, canAssign);
			}
		}

		if (canAssign && this.match(TokenType.EQUAL)) {
			this.errorAt(this.parser.current, "Invalid assignment target.");
		}
	}

	parseVariable(err: string) {
		this.consume(TokenType.IDENTIFIER, err);

		this.declareVariable();
		if (this.scopeDepth > 0) return 0;

		return this.identifierConstant(this.parser.previous);
	}

	object() {
		const obj = this.makeConstant({ type: "object", value: {} });
		do {
			if (this.match(TokenType.IDENTIFIER)) {
				const name = this.parser.previous;

				this.consume(TokenType.COLON, "expected colon");
				this.emitBytes(OpCode.CONSTANT, obj);
				this.expression();
				this.emitBytes(OpCode.SET_FIELD, this.identifierConstant(name));
				this.emitByte(OpCode.POP); // Pop the value pushed by SET_FIELD.
			} else {
				break;
			}
		} while (this.match(TokenType.COMMA));
		this.consume(TokenType.RIGHT_BRACE, "Expected '}' to close object.");

		this.emitBytes(OpCode.CONSTANT, obj);
	}

	/// Declarations

	declaration() {
		if (this.match(TokenType.VAR)) {
			this.varDeclaration();
		} else if (this.match(TokenType.FN)) {
			this.fnDeclaration();
		} else if (this.match(TokenType.IF)) {
			this.ifStatement();
		} else if (this.match(TokenType.WHILE)) {
			this.whileStatement();
		} else if (this.match(TokenType.FOR)) {
			this.forStatement();
		} else if (this.match(TokenType.LEFT_BRACE)) {
			this.startScope();
			this.block();
			this.endScope();
		} else if (this.match(TokenType.RETURN)) {
			this.returnStatement();
		} else if (this.match(TokenType.USE)) {
			this.useStatement();
		} else {
			this.statement();
		}

		if (this.parser.panicMode) this.parser.synchronize();
	}

	declareVariable() {
		if (this.scopeDepth === 0) return;
		const name = this.parser.previous;

		for (let i = this.localCount - 1; i >= 0; i--) {
			const local_ = this.locals[i];

			if (local_.depth !== -1 && local_.depth < this.scopeDepth) {
				break;
			}

			if (local_.name === name.lexeme) {
				this.errorAt(this.parser.current, "Already a variable with this name in this scope!");
			}
		}

		this.addLocal(name);
	}

	fnDeclaration() {
		const global = this.parseVariable("Expect function name.");
		this.markInitialized();

		this.makeFunction(FunctionType.FUNCTION);
		this.defineVariable(global);
	}

	varDeclaration() {
		const global = this.parseVariable("Expect Variable Name");

		if (this.match(TokenType.EQUAL)) {
			this.expression();
		} else {
			this.emitByte(OpCode.NIL);
		}

		this.defineVariable(global);
	}

	/// Statements

	useStatement() {
		this.consume(TokenType.IDENTIFIER, "Expected library name after use statment!");
		const library = this.parser.previous.lexeme;
		const importPaths: string[] = [];

		// Recursive function which adds all import paths to importPaths.
		const parseImport: (path: string) => void = (path: string) => {
			if (this.match(TokenType.DOT)) {
				if (this.match(TokenType.LEFT_PAREN)) {
					do {
						this.consume(TokenType.IDENTIFIER, "Expected import name");
						parseImport(path + "." + this.parser.previous.lexeme);
					} while (this.match(TokenType.COMMA));
					this.consume(TokenType.RIGHT_PAREN, "Expected left brace to close right brace");
					return;
				} else if (this.match(TokenType.IDENTIFIER)) {
					return parseImport(path + "." + this.parser.previous.lexeme);
				}
			}

			importPaths.push(path);
		};

		parseImport(library);

		// Load those imports as variables:
		importPaths.forEach((path) => {
			const split = path.split(".");
			const name = split[split.size() - 1];
			let value: RueValue;

			split.forEach((index) => {
				if (!value || value.type === "nil") {
					value = this.libraries.get(index)!;
					return;
				}

				if (value.type === "object") {
					value = value.value[index];
					if (!value) {
						this.errorAt(this.parser.previous, `Couldn't import ${path}`);
					}
				}
			});

			this.emitBytes(OpCode.CONSTANT, this.makeConstant(value!));
			this.emitBytes(OpCode.DEFINE_GLOBAL, this.makeConstant({ type: "string", value: name }));
		});
	}

	ifStatement() {
		this.expression();
		const thenJump = this.emitJump(OpCode.JUMP_IF_FALSE);
		this.emitByte(OpCode.POP);
		this.declaration();
		this.patchJump(thenJump);

		if (this.match(TokenType.ELSE)) {
			this.emitByte(OpCode.POP);
			const elseJump = this.emitJump(OpCode.JUMP);
			this.statement();
			this.patchJump(elseJump);
		}
	}

	whileStatement() {
		const loopStart = this.currentChunk().code.size();
		this.expression();

		const exitJump = this.emitJump(OpCode.JUMP_IF_FALSE);
		this.emitByte(OpCode.POP);

		this.declaration();

		this.emitLoop(loopStart);
		this.patchJump(exitJump);

		this.emitByte(OpCode.POP);
	}

	forStatement() {
		this.startScope();

		// Match for intializer
		if (this.match(TokenType.COMMA)) {
			// No initializer
		} else {
			if (this.match(TokenType.VAR)) {
				this.varDeclaration();
			} else {
				this.expressionStatement();
			}

			this.consume(TokenType.COMMA, "Expect ',' after loop intializer");
		}

		let loopStart = this.currentChunk().code.size();

		// Match for condition clause
		let exitJump = -1;
		if (!this.match(TokenType.COMMA)) {
			this.expression();
			this.consume(TokenType.COMMA, "Expect ',' after loop condition");

			exitJump = this.emitJump(OpCode.JUMP_IF_FALSE);
			this.emitByte(OpCode.POP);
		}

		// Match for increment
		if (!this.match(TokenType.COMMA)) {
			const bodyJump = this.emitJump(OpCode.JUMP);
			const incrementStart = this.currentChunk().code.size();

			this.expression();

			this.emitByte(OpCode.POP);
			this.emitLoop(loopStart);
			loopStart = incrementStart;
			this.patchJump(bodyJump);
		}

		this.declaration();
		this.emitLoop(loopStart);

		if (exitJump !== -1) {
			this.patchJump(exitJump);
			this.emitByte(OpCode.POP);
		}

		this.endScope();
	}

	block() {
		while (this.parser.current.type !== TokenType.RIGHT_BRACE && this.parser.current.type !== TokenType.EOF) {
			this.declaration();
		}

		this.consume(TokenType.RIGHT_BRACE, "Expect '}' after block.");
	}

	expressionStatement() {
		this.expression();
		this.emitByte(OpCode.POP);
	}

	statement() {
		this.expressionStatement();
	}

	returnStatement() {
		if (this.parser.current.type === TokenType.EOF || this.parser.current.type === TokenType.RIGHT_BRACE) {
			this.emitByte(OpCode.NIL);
		} else {
			this.expression();
		}
		this.emitByte(OpCode.RETURN);
	}

	/// Utility Functions

	startScope() {
		this.scopeDepth++;
	}

	endScope() {
		this.scopeDepth--;
		while (this.localCount > 0 && this.locals[this.localCount - 1].depth > this.scopeDepth) {
			this.emitByte(OpCode.POP);
			this.localCount--;
		}
	}

	namedVariable(name: Token, canAssign: boolean) {
		let [getOp, setOp] = [OpCode.GET_GLOBAL, OpCode.SET_GLOBAL];

		let arg = this.resolveLocal(name);

		if (arg !== -1) {
			getOp = OpCode.GET_LOCAL;
			setOp = OpCode.SET_LOCAL;
		} else {
			arg = this.resolveUpvalue(name);
			if (arg !== -1) {
				getOp = OpCode.GET_UPVALUE;
				setOp = OpCode.SET_UPVALUE;
			} else {
				arg = this.identifierConstant(name);
			}
		}

		if (canAssign && this.match(TokenType.EQUAL)) {
			this.expression();
			this.emitBytes(setOp, arg);
		} else {
			this.emitBytes(getOp, arg);
		}
	}

	identifierConstant(name: Token) {
		return this.currentChunk().addConstant({
			type: "string",
			value: name.lexeme,
		});
	}

	argumentList() {
		let argCount = 0;
		if (this.parser.current.type !== TokenType.RIGHT_PAREN) {
			do {
				this.expression();
				argCount++;
			} while (this.match(TokenType.COMMA));
		}
		this.consume(TokenType.RIGHT_PAREN, "Expect ')' after arguments.");
		return argCount;
	}

	makeFunction(type_: FunctionType) {
		const compiler = new Compiler(
			{
				type: "function",
				value: { chunk: new Chunk(), arity: 0, upvalueCount: 0, name: this.parser.previous.lexeme },
			},
			type_,
			this.parser,
			this.libraries,
		);

		compiler.enclosing = this;
		compiler.startScope();
		compiler.consume(TokenType.LEFT_PAREN, "Expect '(' after function name.");

		if (compiler.parser.current.type !== TokenType.RIGHT_PAREN) {
			do {
				compiler.function.value.arity++;

				const constant = compiler.parseVariable("Expect Parameter name.");
				compiler.defineVariable(constant);
			} while (compiler.match(TokenType.COMMA));
		}

		compiler.consume(TokenType.RIGHT_PAREN, "Expect ')' after parameters.");
		compiler.consume(TokenType.LEFT_BRACE, "Expect '{' before function body.");
		compiler.block();

		const fn = compiler.endCompiler();
		this.emitBytes(OpCode.CLOSURE, this.makeConstant({ type: "closure", value: { fn, upvalues: [] } }));

		for (let i = 0; i < fn.value.upvalueCount; i++) {
			this.emitBytes(compiler.upvalues[i].value.isLocal ? 1 : 0, compiler.upvalues[i].value.index);
		}
	}

	expression() {
		this.parsePrecedence(Precendence.ASSIGNMENT);
	}

	markInitialized() {
		if (this.scopeDepth === 0) return;
		this.locals[this.localCount - 1].depth = this.scopeDepth;
	}

	addLocal(name: Token) {
		this.locals[this.localCount++] = {
			name: name.lexeme,
			depth: -1,
			isCaptured: false,
		};
	}

	addUpvalue(index: number, local_: boolean) {
		const upvalueCount = this.function.value.upvalueCount;

		for (let i = 0; i < upvalueCount; i++) {
			const upvalue = this.upvalues[i];
			if (upvalue.value.index === index && upvalue.value.isLocal === local_) {
				return i;
			}
		}

		this.upvalues[upvalueCount] = { type: "upvalue", value: { isLocal: local_, index, value: { type: "nil" } } };
		return this.function.value.upvalueCount++;
	}

	defineVariable(global: number) {
		if (this.scopeDepth > 0) {
			this.markInitialized();
			return;
		}
		this.emitBytes(OpCode.DEFINE_GLOBAL, global);
	}

	resolveLocal(name: Token) {
		for (let i = this.localCount - 1; i >= 0; i--) {
			const local_ = this.locals[i];
			if (local_.name === name.lexeme) {
				if (local_.depth === -1) {
					this.errorAt(this.parser.current, "Can't read local variable in its own initializer.");
				}
				return i;
			}
		}

		return -1;
	}

	resolveUpvalue(name: Token): number {
		if (this.enclosing === undefined) return -1;

		const local_ = this.enclosing.resolveLocal(name);
		if (local_ !== -1) {
			this.enclosing.locals[local_].isCaptured = true;
			return this.addUpvalue(local_, true);
		}

		const upvalue = this.enclosing.resolveUpvalue(name);
		if (upvalue !== -1) {
			return this.addUpvalue(upvalue, false);
		}

		return -1;
	}

	advance() {
		this.parser.advance();
	}

	endCompiler() {
		if (Debug.Config.DEBUG_TRACE_EXECUTION && !this.parser.hadError) {
			Debug.DisassembleChunk(this.currentChunk(), this.function.value.name);
		}

		return this.function;
	}

	constructor(fn: RueFunction, type_: FunctionType, public parser: Parser, private libraries: Map<string, RueValue>) {
		this.function = fn;
		this.locals[this.localCount++] = { depth: 0, name: "", isCaptured: false };
		this.type = type_;
	}
}
