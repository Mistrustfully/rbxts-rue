export function padNumber(number: number, size: number) {
	let numberString = tostring(number);

	while (numberString.size() < size) {
		numberString = "0" + numberString;
	}

	return numberString;
}

export function isDigit(c: string) {
	return c.byte(0, 0)[0] >= "0".byte(0, 0)[0] && c.byte(0, 0)[0] <= "9".byte(0, 0)[0];
}

export function isAlpha(c: string) {
	return (
		(c.byte(0, 0)[0] >= "a".byte(0, 0)[0] && c.byte(0, 0)[0] <= "z".byte(0, 0)[0]) ||
		(c.byte(0, 0)[0] >= "A".byte(0, 0)[0] && c.byte(0, 0)[0] <= "Z".byte(0, 0)[0]) ||
		c.byte(0, 0)[0] === "_".byte(0, 0)[0]
	);
}

export function stringToDigit(c: string) {
	return tonumber(c);
}
