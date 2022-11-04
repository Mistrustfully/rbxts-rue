import { RueValue } from "./common/value";

const std: { [index: string]: RueValue } = {
	print: {
		type: "nativeFunction",
		value: (valToPrint: RueValue) => {
			if (valToPrint.type === "nil") return valToPrint;
			print(valToPrint.value);

			return { type: "nil" };
		},
	},

	assert: {
		type: "nativeFunction",
		value: (assertVal: RueValue) => {
			if (assertVal.type === "nil") return { type: "error", value: "Value was nil!" };
			if (assertVal.type !== "boolean") return { type: "error", value: "Value wasn't a boolean!" };
			if (!assertVal.value) return { type: "error", value: "Value was false!" };

			return { type: "nil" };
		},
	},
};

export default std;
