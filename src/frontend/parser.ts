import { Token, TokenType } from "../common/token";
import { Scanner } from "./scanner";

export class Parser {
	public current!: Token;
	public previous!: Token;
	public hadError = false;
	public panicMode = false;

	constructor(public scanner: Scanner) {}
	advance() {
		this.previous = this.current;
		for (;;) {
			this.current = this.scanner.scanToken();
			if (this.current.type !== TokenType.ERROR) break;

			// this.errorAt(this.current, this.current.lexeme);
		}
	}
	synchronize() {
		this.panicMode = false;

		while (this.current.type !== TokenType.EOF) {
			switch (this.current.type) {
				case TokenType.CLASS:
				case TokenType.FN:
				case TokenType.VAR:
				case TokenType.FOR:
				case TokenType.IF:
				case TokenType.WHILE:
				case TokenType.USE:
				case TokenType.RETURN:
					return;
			}

			this.advance();
		}
	}
}
