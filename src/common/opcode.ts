export const enum OpCode {
	// Constants
	NIL,
	TRUE,
	FALSE,
	CONSTANT,
	CLOSURE,

	// Arithmetic
	NOT,
	NEGATE,
	ADD,
	SUBTRACT,
	MULTIPLY,
	DIVIDE,

	// Compators
	EQUAL,
	GREATER,
	LESS,

	// Jumps
	JUMP_IF_FALSE,
	JUMP,
	LOOP,

	// Getters & Setters
	DEFINE_GLOBAL,
	GET_GLOBAL,
	SET_GLOBAL,
	GET_LOCAL,
	SET_LOCAL,
	GET_UPVALUE,
	SET_UPVALUE,
	GET_FIELD,
	SET_FIELD,

	// Others
	RETURN,
	CALL,
	POP,
	USE,
}
