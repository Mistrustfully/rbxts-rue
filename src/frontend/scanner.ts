import { Token, TokenType } from "../common/token";
import { isAlpha, isDigit } from "../util";

export class Scanner {
	public line = 1;
	public start = 0;
	public current = 0;

	isAtEnd() {
		return this.source.size() - 1 === this.current;
	}

	makeToken(type_: TokenType) {
		return new Token(type_, this.source.sub(this.start, this.current), this.line);
	}

	errorToken(message: string) {
		const token = this.makeToken(TokenType.ERROR);
		token.lexeme = message;

		return token;
	}

	advance() {
		this.current++;
		return this.source.sub(this.current - 1, this.current);
	}

	match(expected: string) {
		if (this.isAtEnd()) return false;
		if (this.peek() !== expected) return false;

		this.current++;
		return true;
	}

	peek() {
		return this.source.sub(this.current, this.current + 1);
	}

	peekNext() {
		return this.source.sub(this.current + 1, this.current + 2);
	}

	skipWhitespace() {
		for (;;) {
			if (this.isAtEnd()) return;

			const c = this.peek();
			switch (c) {
				case "\n":
					this.line++;
					this.advance();
					break;
				case ";":
				case " ":
				case "\r":
				case "\t":
					this.advance();
					break;
				case "/":
					if (this.peekNext() === "/") {
						// A comment goes until the end of the line.
						while (this.peek() !== "\n" && !this.isAtEnd()) this.advance();
					} else {
						return;
					}
					break;
				default:
					return;
			}
		}
	}

	identifierType(lexeme: string) {
		function checkKeyword(start: number, rest: string, type_: TokenType) {
			if (lexeme.sub(start, lexeme.size()) === rest) {
				return type_;
			}
			return TokenType.IDENTIFIER;
		}

		switch (lexeme.sub(0, 0)) {
			case "a":
				return checkKeyword(1, "nd", TokenType.AND);
			case "c":
				return checkKeyword(1, "lass", TokenType.CLASS);
			case "e":
				return checkKeyword(1, "lse", TokenType.ELSE);
			case "f":
				switch (lexeme.sub(1, 1)) {
					case "a":
						return checkKeyword(2, "lse", TokenType.FALSE);
					case "o":
						return checkKeyword(2, "r", TokenType.FOR);
					case "n":
						return checkKeyword(2, "", TokenType.FN);
				}
				break;
			case "i":
				return checkKeyword(1, "f", TokenType.IF);
			case "n":
				return checkKeyword(1, "il", TokenType.NIL);
			case "o":
				return checkKeyword(1, "r", TokenType.OR);
			case "r":
				return checkKeyword(1, "eturn", TokenType.RETURN);
			case "t":
				switch (lexeme.sub(1, 1)) {
					case "h":
						return checkKeyword(2, "is", TokenType.THIS);
					case "r":
						return checkKeyword(2, "ue", TokenType.TRUE);
				}
				break;
			case "u":
				return checkKeyword(1, "se", TokenType.USE);
			case "v":
				return checkKeyword(1, "ar", TokenType.VAR);
			case "w":
				return checkKeyword(1, "hile", TokenType.WHILE);
		}

		return TokenType.IDENTIFIER;
	}

	// Literals

	string() {
		while (this.peek() !== '"' && !this.isAtEnd()) {
			if (this.peek() === "\n") return this.errorToken("Unexpected newline in string.");
			this.advance();
		}

		if (this.isAtEnd()) return this.errorToken("Unterminated string.");
		this.advance();

		return this.makeToken(TokenType.STRING);
	}

	number() {
		while (isDigit(this.peek())) this.advance();
		if (this.peek() === "." && isDigit(this.peekNext())) {
			this.advance();
			while (isDigit(this.peek())) this.advance();
		}

		return this.makeToken(TokenType.NUMBER);
	}

	identifier() {
		while (isAlpha(this.peek()) || isDigit(this.peek())) this.advance();
		return this.makeToken(this.identifierType(this.source.sub(this.start, this.current)));
	}

	scanToken() {
		this.skipWhitespace();

		this.start = this.current;
		if (this.isAtEnd()) return this.makeToken(TokenType.EOF);

		if (isDigit(this.peek())) {
			return this.number();
		}

		if (isAlpha(this.peek())) {
			return this.identifier();
		}

		const c = this.advance();
		switch (c) {
			case "(":
				return this.makeToken(TokenType.LEFT_PAREN);
			case ")":
				return this.makeToken(TokenType.RIGHT_PAREN);
			case "{":
				return this.makeToken(TokenType.LEFT_BRACE);
			case "}":
				return this.makeToken(TokenType.RIGHT_BRACE);
			case ",":
				return this.makeToken(TokenType.COMMA);
			case ".":
				return this.makeToken(TokenType.DOT);
			case "-":
				return this.makeToken(TokenType.MINUS);
			case "+":
				return this.makeToken(TokenType.PLUS);
			case "/":
				return this.makeToken(TokenType.SLASH);
			case "*":
				return this.makeToken(TokenType.STAR);
			case "!":
				return this.makeToken(this.match("=") ? TokenType.BANG_EQUAL : TokenType.BANG);
			case "=":
				return this.makeToken(this.match("=") ? TokenType.EQUAL_EQUAL : TokenType.EQUAL);
			case "<":
				return this.makeToken(this.match("=") ? TokenType.LESS_EQUAL : TokenType.LESS);
			case ">":
				return this.makeToken(this.match("=") ? TokenType.GREATER_EQUAL : TokenType.GREATER);
			case ":":
				return this.makeToken(this.match(":") ? TokenType.SCOPE : TokenType.COLON);
			case '"':
				return this.string();
		}

		return this.errorToken("Unexpected character.");
	}

	constructor(public source: string) {}
}
