var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");

window.addEventListener("resize", function() {
	editor.updateDisplaySizes();
	stackDisplay.style.width = (window.innerWidth - 315) + "px";
	output.style.width = (window.innerWidth - 315) + "px";
});
canvas.addEventListener("contextmenu", function(event) { event.preventDefault(); });
mouse.relativeToElement = canvas;

canvas.addEventListener("mousemove", function(event) {
	if (mouse.l && editor.mode == "edit") {
		cursor.updateSelection();
		if (cursor.select.start.x != cursor.select.end.x || cursor.select.start.y != cursor.select.end.y) cursor.select.ka = true;
	}
});
canvas.addEventListener("mousedown", function(event) {
	if (event.button == 2) return;
	if (event.button == 0) {
		if (editor.mode == "edit") {
			cursor.moveTo(floor(editor.Px(mouse.x + canvas.parentElement.scrollLeft)), floor(editor.Py(mouse.y +  + canvas.parentElement.scrollTop)));
			cursor.select.ka = false;
			cursor.updateSelection();
		}
	} else if (event.button == 1) {
		// right click function
	}
});
window.addEventListener("keydown", function(event) {
	keys[event.which || event.keyCode] = true;
	if (event.keyCode == 32) {
		event.preventDefault(); // stop space bar from activating buttons
		canvas.focus();
	}

	if (editor.mode == "edit") {
		var k = event.keyCode;
		if (!event.metaKey && !event.ctrlKey && (k == 32 || (k >= 48 && k <= 57) || (k >= 65 && k <= 90) || (k >= 186 && k <= 192) || (k >= 219 && k <= 222))) { // general character typing
			cursor.type(event.key);
		}

		if (event.ctrlKey || event.metaKey) { // control/command key effects
			let saveData; // I don't know why but switches don't do variable scopes like you'd expect
			switch (k) {
			case 85: // command u, save
				saveData = editor.save();
				window.clientInformation.clipboard.writeText(saveData);
				break;
			case 73: // command i, load
				let loadData = prompt("Enter save data:");
				mouse.l = false; // fix bug where prompt window messes with the mouse button
				if (loadData) editor.load(loadData);
				break;
			case 67: // command c, copy
				saveData = arrayToText(cursor.getSelectionData(), cursor.getSelectionWidth());
				window.clientInformation.clipboard.writeText(saveData);
				cursor.clipboard = saveData;
				break;
			case 86: // command v, paste
				if (event.shiftKey || cursor.clipboard == "") cursor.clipboard = prompt("Paste clipboard here:") || "";
				mouse.l = false; // window prompt mouse button bug fix
				cursor.paste(cursor.clipboard);
				break;
			case 88: // command x, cut
				saveData = arrayToText(cursor.getSelectionData(), cursor.getSelectionWidth());
				window.clientInformation.clipboard.writeText(saveData);
				cursor.clipboard = saveData;
				cursor.clearSelection();
				break;
			case 65: // command a, select all
				cursor.select.start = {x: 0, y: 0};
				cursor.select.end = {x: editor.width - 1, y: editor.height - 1};
				cursor.select.ka = true;
				break;
			}
		}

		switch (event.keyCode) {
		case 8: // backspace
			if (cursor.select.ka) cursor.clearSelection();
			else cursor.backspace();
			break;
		}

		// arrow key functions
		if (k >= 37 && k <= 40)
		if (event.shiftKey) {
			if (event.altKey) {
				switch(k) { // alt-shift: remove rows and columns
					case 37: editor.deleteColumns(cursor.x - 1); cursor.x = max(cursor.x - 1, 0); break;
					case 38: editor.deleteRows(cursor.y - 1); cursor.y = max(cursor.y - 1, 0); break;
					case 39: editor.deleteColumns(cursor.x + 1); break;
					case 40: editor.deleteRows(cursor.y + 1); break;
				}
			} else {
				cursor.displayCdc = cursor.displayCd / 2;
				switch (k) { // shift: change typing direction
					case 37: cursor.d.c = [-1, 0]; break;
					case 38: cursor.d.c = [0, -1]; break;
					case 39: cursor.d.c = [1, 0]; break;
					case 40: cursor.d.c = [0, 1]; break;
				}
			}
		} else if (event.altKey) {
			switch (k) { // alt: add rows and columns
				case 37: editor.insertColumns(cursor.x); cursor.x++; break;
				case 38: editor.insertRows(cursor.y); cursor.y++; break;
				case 39: editor.insertColumns(cursor.x + 1); break;
				case 40: editor.insertRows(cursor.y + 1); break;
			}
		} else switch (k) { // no mod keys: move the cursor
			case 37: cursor.move([-1, 0], true); break;
			case 38: cursor.move([0, -1], true); break;
			case 39: cursor.move([1, 0], true); break;
			case 40: cursor.move([0, 1], true); break;
		}
	}
});


function arrayToText(array, width) {
	const rows = [];
	for (let y = 0; y < array.length/width; y++) {
		const line = [];
		for (let x = 0; x < width; x++) {
			if (array[x + y*width] == 10) line.push(String.fromCharCode(-2));
			else line.push(String.fromCharCode(array[x + y*width]));
		}
		while (line[line.length - 1] == " ") {
			line.pop();
		}
		rows.push(line.join(""));
	}
	let i = rows.length - 1;
	while (rows[i] == "" && i > 0) {
		rows.pop();
		i--;
	}
	return rows.join("\n");
};

function textToArray(text, width=0, height=0) {
	rows = text.split("\n");

	if (width < 1) {
		for (const row of rows) {
			if (row.length > width) width = row.length;
		}
	}

	if (height < rows.length) height = rows.length;

	const array = new Int32Array(width * height);
	for (let i = 0; i < width * height; i++) array[i] = 32;

	for (let y = 0; y < rows.length; y++) {
		for (let x = 0; x < rows[y].length; x++) {
			if (rows[y].charAt(x) == String.fromCharCode(-2)) array[x + y*width] = 10;
			else array[x + y*width] = rows[y].charCodeAt(x);
		}
	}

	return [array, width];
};


const widthPerPoint = 0.60009765625, heightPerPoint = 1.135, heightOffset = 0.06;


class Editor {
	constructor(width=64, height=32, typeface="Courier") {
		this.width = width;
		this.height = height;
		this.requiredRemainderHeight = 270;
		this.fontSizeMinimum = 20;
		this.typeface = typeface;
		this.load("");
		this.mode = "edit";
	};
	draw() {
		if (this.mode == "run") return;
		ctx.font = this.font;
		ctx.fillStyle = "#000000";
		ctx.textAlign = "start";
		ctx.textBaseline = "top";
		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				ctx.fillText(String.fromCharCode(this.data[x + y*this.width]), this.Lx(x), this.Ly(y + heightOffset));
			}
		}
	};
	save() { return this.width + "," + this.height + String.fromCharCode(-1) + "\n" + arrayToText(this.data, this.width); };
	load(data="") {
		if (data != "") {
			data = data.split(String.fromCharCode(-1) + "\n");
			if (data.length > 1) {
				let dim = data.shift().split(",");
				this.width = parseInt(dim[0]);
				this.height = parseInt(dim[1]);
			}
			data = data[0];
		}
		this.data = textToArray(data, this.width, this.height)[0];
		this.updateDisplaySizes();
	};
	resize(width, height) {
		const data = new Int32Array(width * height);
		for (let x = 0; x < width; x++) {
			for (let y = 0; y < height; y++) {
				if (x < this.width && y < this.height) data[x + y*width] = this.data[x + y*this.width];
				else data[x + y*width] = 32;
			}
		}
		this.width = width;
		this.height = height;
		this.data = data;
		this.updateDisplaySizes();
	};
	insertRows(index, count=1) {
		if (index < 0 || index > this.height) return;

		this.height += count;
		const data = new Int32Array(this.width * this.height);
		const splitIndex = index * this.width;
		const splitSize = count * this.width;
		let i = 0;
		for (; i < splitIndex; i++) data[i] = this.data[i];
		for (; i < splitIndex + splitSize; i++) data[i] = 32;
		for (; i < data.length; i++) data[i] = this.data[i - splitSize];
		this.data = data;
		this.updateDisplaySizes();
	};
	insertColumns(index, count=1) {
		if (index < 0 || index > this.width) return;

		const width = this.width + count;
		const data = new Int32Array(width * this.height);
		for (let y = 0; y < this.height; y++) {
			let i = 0;
			for (; i < index; i++) data[i + y*width] = this.data[i + y*this.width];
			for (; i < index + count; i++) data[i + y*width] = 32;
			for (; i < width; i++) data[i + y*width] = this.data[i - count + y*this.width];
		}
		this.width = width;
		this.data = data;
		this.updateDisplaySizes();
	};
	deleteRows(index, count=1) {
		if (index >= this.height) return;
		if (index < 0) {
			if (count > -index) {
				index = 0;
				count += index;
			} else return;
		}
		if (index + count > this.height) count = this.height - index;

		this.height -= count;
		const data = new Int32Array(this.width * this.height);
		const splitIndex = index * this.width;
		const splitSize = count * this.width;
		let i = 0;
		for (; i < splitIndex; i++) data[i] = this.data[i];
		for (; i < data.length; i++) data[i] = this.data[i + splitSize];
		this.data = data;
		this.updateDisplaySizes();
	};
	deleteColumns(index, count=1) {
		if (index >= this.width) return;
		if (index < 0) {
			if (count > -index) {
				index = 0;
				count += index;
			} else return;
		}
		if (index + count > this.width) count = this.width - index;

		const width = this.width - count;
		const data = new Int32Array(width * this.height);
		for (let y = 0; y < this.height; y++) {
			let i = 0;
			for (; i < index; i++) data[i + y*width] = this.data[i + y*this.width];
			for (; i < width; i++) data[i + y*width] = this.data[i + count + y*this.width];
		}
		this.width = width;
		this.data = data;
		this.updateDisplaySizes();
	};
	updateDisplaySizes() {
		this.fontSize = (window.innerHeight - this.requiredRemainderHeight) / (this.height * heightPerPoint);
		let scaleFactor = 1;
		if (this.fontSize < this.fontSizeMinimum) scaleFactor = this.fontSizeMinimum / this.fontSize, this.fontSize = this.fontSizeMinimum;
		canvas.width = this.width * this.fontSize * widthPerPoint;
		canvas.height = (window.innerHeight - this.requiredRemainderHeight) * scaleFactor;
		canvas.parentElement.style.width = min(canvas.width / scaleFactor, window.innerWidth - 60) + "px";
		canvas.parentElement.style.height = window.innerHeight - this.requiredRemainderHeight + 4 + "px";
	};
	get font() { return this.fontSize + "px " + this.typeface; };
	Px(lx) { return lx / (editor.fontSize * widthPerPoint); };
	Py(ly) { return ly / (editor.fontSize * heightPerPoint); };
	Lx(px) { return px * this.fontSize * widthPerPoint; };
	Ly(py) { return py * this.fontSize * heightPerPoint; };
};


class Interpreter {
	constructor(editor) {
		this.editor = editor;
		this.width = this.editor.width;
		this.height = this.editor.height;
		this.stackstack = [[]];
		this.speed = 10000;
		this.x = 0;
		this.y = 0;
		this.d = new V(1, 0);
		this.color = "rgba(63, 255, 63, 0.3)";
		this.paused = true;
		this.atEnd = false;
		this.asyncLooping = false;
		this.readingString = false;
		this.data = textToArray("", this.width, this.height)[0];
		this.useFunge98Instructions = true;
		this.storageOffset = new V(0, 0);
		this.fastRand = true;
	};
	static instructionCodes = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 43, 45, 42, 47, 37, 33, 96, 62, 60, 94, 118, 63, 95, 124, 34, 58, 92, 36, 46, 44, 35, 112, 103, 38, 126, 64, 97, 98, 99, 100, 101, 102, 114, 93, 91, 120, 59, 106, 113, 107, 119, 39, 115, 110, 123, 125, 117, 61, 165];
	get stack() { return this.stackstack[max(this.stackstack.length-1, 0)]; };
	set stack(n) { this.stackstack[max(this.stackstack.length-1, 0)] = n; };
	draw() {
		if (this.editor.mode != "run") return;

		ctx.font = this.editor.font;
		ctx.fillStyle = "#000000";
		ctx.textAlign = "start";
		ctx.textBaseline = "top";
		for (var x = 0; x < this.width; x++) {
			for (var y = 0; y < this.height; y++) {
				ctx.fillText(String.fromCharCode(this.data[x + y*this.width]), this.editor.Lx(x), this.editor.Ly(y + heightOffset));
			}
		}

		ctx.fillStyle = this.color;
		ctx.fillRect(this.editor.Lx(this.x), this.editor.Ly(this.y), this.editor.Lx(this.x + 1) - this.editor.Lx(this.x), this.editor.Ly(this.y + 1) - this.editor.Ly(this.y));
	};
	executeInstruction(charCode, thisX=this.x, thisY=this.y) {
		const stack = this.stack;
		const stack2 = this.stackstack[this.stackstack-2];
		const char = String.fromCharCode(charCode);
		let a, b, n, v, x, y;

		main:
		switch (char) {
			case "0": stack.push(0); break;
			case "1": stack.push(1); break;
			case "2": stack.push(2); break;
			case "3": stack.push(3); break;
			case "4": stack.push(4); break;
			case "5": stack.push(5); break;
			case "6": stack.push(6); break;
			case "7": stack.push(7); break;
			case "8": stack.push(8); break;
			case "9": stack.push(9); break;
			case "+": stack.push((stack.pop() || 0) + (stack.pop() || 0)); break;
			case "-": stack.push(-(stack.pop() || 0) + (stack.pop() || 0)); break;
			case "*": stack.push((stack.pop() || 0) * (stack.pop() || 0)); break;
			case "/": a = stack.pop() || 0, b = stack.pop() || 0; stack.push(sign(a * b) * floor(abs(b / a))); break;
			case "%": a = stack.pop() || 0, b = stack.pop() || 0; stack.push(b % a); break;
			case "!": if ((stack.pop() || 0) == 0) stack.push(1); else stack.push(0); break;
			case "`": a = stack.pop() || 0, b = stack.pop() || 0; if (b > a) stack.push(1); else stack.push(0); break;
			case ">": this.d.c = [1, 0]; break;
			case "<": this.d.c = [-1, 0]; break;
			case "^": this.d.c = [0, -1]; break;
			case "v": this.d.c = [0, 1]; break;
			case "?": const fullList = [[1, 0], [-1, 0], [0, -1], [0, 1]]; if (!this.fastRand) this.d.c = random.choose(fullList); else {
				const list = [], idList = [60, 62, 118, 94];
				for (let i in fullList) {
					[x, y] = lineWrapMove(thisX, thisY, fullList[i], this.width, this.height);
					if (this.data[x + y*this.width] == idList[i]) list.push(fullList[i]);
				}
				if (list.length == 0) this.atEnd = true, this.paused = true;
				else this.d.c = random.choose(list);
			} break;
			case "_": if ((stack.pop() || 0) == 0) this.d.c = [1, 0]; else this.d.c = [-1, 0]; break;
			case "|": if ((stack.pop() || 0) == 0) this.d.c = [0, 1]; else this.d.c = [0, -1]; break;
			case '"': this.readingString = !this.readingString; break;
			case ":": v = stack.pop() || 0; stack.push(v); stack.push(v); break;
			case "\\": a = stack.pop() || 0, b = stack.pop() || 0; stack.push(a); stack.push(b); break;
			case "$": stack.pop(); break;
			case ".": this.output((stack.pop() || 0) + " "); break;
			case ",": this.output(String.fromCharCode(stack.pop() || 0)); break;
			case "#": this.move(); break;
			case "p": y = (stack.pop() || 0) + this.storageOffset.y, x = (stack.pop() || 0) + this.storageOffset.x, v = stack.pop() || 0;
				if (x >= 0 && x < this.width && y >= 0 && y < this.height) this.data[x + y*this.width] = v;
				else console.warn("p operation coordinates out of valid range. p at " + thisX + ", " + thisY + ", requested position at " + x + ", " + y + "."); break;
			case "g": y = (stack.pop() || 0) + this.storageOffset.y, x = (stack.pop() || 0) + this.storageOffset.x;
				if (x >= 0 && x < this.width && y >= 0 && y < this.height) stack.push(this.data[x + y*this.width]);
				else console.warn("g operation coordinates out of valid range. g at " + thisX + ", " + thisY + ", requested position at " + x + ", " + y + "."); break;
			case "&": stack.push(parseInt(prompt("Program requests an integer:")) || 0); break;
			case "~": this.stack.push(prompt("Program requests a character:").charCodeAt() || 0); break;
			case "@": this.atEnd = true, this.paused = true; break;

			// Most Funge-98 commands and some custom ones
			// Not supported: h l t i o A-Z m y ( )
			/* Additional: {
				¥: requests a string from the user and then pushes it to the stack in reverse order with a 0 at the end
			} */
			default: if (this.useFunge98Instructions) switch(char) {
				case "a": stack.push(10); break;
				case "b": stack.push(11); break;
				case "c": stack.push(12); break;
				case "d": stack.push(13); break;
				case "e": stack.push(14); break;
				case "f": stack.push(15); break;
				case "r": this.d.c = [-this.d.x, -this.d.y]; break;
				case "]": this.d.c = [-this.d.y, this.d.x]; break;
				case "[": this.d.c = [this.d.y, -this.d.x]; break;
				case "x": this.d.y = stack.pop() || 0; this.d.x = stack.pop() || 0; break;
				case ";": this.move(); while (this.data[this.x + this.y*this.width] != 59) this.move(); break;
				case "j": n = stack.pop() || 0; if (a > 0) for (let i = 0; i < a; i++) this.move(); else if (a < 0) for(let i = 0; i < -a; i++) this.move(this.d.mult(-1)); break;
				case "q": this.atEnd = true, this.paused = true; break;
				case "k": n = stack.pop() || 0; if (n <= 0) break; [x, y] = lineWrapMove(thisX, thisY, this.d, this.width, this.height);
					while (!Interpreter.instructionCodes.includes(this.data[x + y*this.height])) {
						if (x == this.x && y == this.y) break main;
						[x, y] = lineWrapMove(x, y, this.d, this.width, this.height);
					}
					const instruction = this.data[x + y*this.height]; if (instruction == 59) break;
					for (let i = 0; i < n; i++) this.executeInstruction(instruction, x, y); break;
				case "w": b = stack.pop() || 0, a = stack.pop() || 0; if (a < b) this.d.c = [this.d.y, -this.d.x]; else if (a > b) this.d.c = [-this.d.y, this.d.x]; break;
				case "'": this.move(); stack.push(this.data[this.x + this.y*this.width]); break;
				case "s": this.move(); this.data[this.x + this.y*this.width] = stack.pop() || 0; break;
				case "n": this.stack = []; break;
				case "{": n = stack.pop() || 0; const newStack = []; 
					if (n > 0) for (let i = 0; i < n; i++) newStack.unshift(stack.pop() || 0);
					else if (n < 0) for (let i = 0; i < -n; i++) stack.push(0);
					stack.push(this.storageOffset.x); stack.push(this.storageOffset.y);
					this.storageOffset.c = lineWrapMove(thisX, thisY, this.d, this.width, this.height);
					this.stackstack.push(newStack); break;
				case "}": if (stack2 == null) this.d.c = [-this.d.x, -this.d.y]; else {
					n = stack.pop() || 0, y = stack2.pop() || 0, x = stack2.pop() || 0;
					this.storageOffset.c = [x, y];
					if (n > 0) for (let i = stack.length - n; i < stack.length; i++) stack2.push(stack[i]);
					else if (n < 0) for (let i = 0; i < -n; i++) stack2.pop();
					this.stackstack.pop();
				} break;
				case "u": if (stack2 == null) this.d.c = [-this.d.x, -this.d.y]; else {
					n = stack.pop() || 0;
					if (n > 0) for (let i = 0; i < n; i++) stack.push(stack2.pop() || 0);
					else if (n < 0) for (let i = 0; i < -n; i++) stack2.push(stack.pop() || 0);
				} break;
				case "=": this.executeInstruction(stack.pop() || 0); break;
				case "¥": stack.push(0); const str = prompt("Program requests a string:") || ""; for (let i = str.length - 1; i >= 0; i--) stack.push(str.charCodeAt(i)); break;
			}
		}
	};
	step() {
		if (this.editor.mode == "edit" && this.paused) this.reset();
		else if (this.atEnd) { this.paused = true; return; }
		
		const charCode = this.data[this.x + this.y*this.width];
		
		if (this.readingString) {
			if (charCode == 34) this.readingString = false;
			else this.stack.push(charCode);
		} else this.executeInstruction(charCode);

		this.move();
	};
	toggleMode() {
		if (this.editor.mode == "edit") {
			this.reset();
		} else {
			output.value = "";
			this.stack = [];
			this.editor.mode = "edit";
			this.paused = true;
			this.asyncLooping = false;
		}
	};
	togglePause() {
		if (this.editor.mode == "edit") {
			this.reset();
			this.paused = false;
		} else {
			if (this.atEnd) this.reset();
			this.paused = !this.paused;
			if (this.asyncLooping) this.asyncLooping = false;
		}
	};
	reset() {
		if (this.editor.mode == "edit") this.editor.mode = "run";
		this.paused = true;
		this.asyncLooping = false;
		this.data = [];
		for (const i of this.editor.data) this.data.push(i);
		this.width = this.editor.width;
		this.height = this.editor.height;
		this.x = 0, this.y = 0, this.d.c = [1, 0];
		this.atEnd = false;
		this.stack = [];
		output.value = "";
	};
	runFrame() {
		if (this.editor.mode != "run" || this.paused) return;

		if (!this.asyncLooping) {
			if (this.speed == -1) {
				// async auto call
				this.asyncLooping = true;
				asyncStep();
			} else for (let a = 0; a < this.speed && !this.atEnd; a++) this.step();
		}

		stackDisplay.scrollTop = 1e12; 	// scroll to the bottom of text boxes
		output.scrollTop = 1e12;		// It's not a perfect method but it works for 35.7 billion lines so I'm fine with it
	};
	output(str) {
		output.value = output.value + str;
	};
	move(d=this.d) { [this.x, this.y] = lineWrapMove(this.x, this.y, d, this.width, this.height); };
};

function asyncStep() { // this would be a method of Interpreter but setTimeout doesn't let that work
	if (interpreter.step()) interpreter.asyncLooping = false;
	if (interpreter.asyncLooping) setTimeout(asyncStep, 0);
};


class Cursor {
	constructor(editor, color="rgba(255, 31, 31, 0.5)", selectColor="rgba(255, 0, 0, 0.3)") {
		this.editor = editor;
		this.x = 0;
		this.y = 0;
		this.d = new V(1, 0);
		this.select = {
			ka: false,
			start: new V(0, 0),
			end: new V(0, 0)
		};
		this.clipboard = "";
		this.displayCd = 120;
		this.displayCdc = 0;
		this.color = color;
		this.selectColor = selectColor;
	};
	draw() {
		if (this.editor.mode == "run") return;
		if (this.select.ka) {
			ctx.fillStyle = this.selectColor;
			ctx.fillRect(this.editor.Lx(this.select.start.x), this.editor.Ly(this.select.start.y), this.editor.Lx(this.getSelectionWidth()), this.editor.Ly(this.getSelectionHeight()));

		} else {
			this.displayCdc++; // increment cooldown counter
			if (this.displayCdc >= this.displayCd) this.displayCdc = 0; // cycle

			// it isn't drawn for two 1/4 sections to make it flash between the two display types
			ctx.fillStyle = this.color;
			ctx.beginPath();
			if (this.displayCdc < this.displayCd / 4) { // 1/4 of the time will display as a rectangle
				ctx.moveTo(this.editor.Lx(this.x), this.editor.Ly(this.y));
				ctx.lineTo(this.editor.Lx(this.x + 1), this.editor.Ly(this.y));
				ctx.lineTo(this.editor.Lx(this.x + 1), this.editor.Ly(this.y + 1));
				ctx.lineTo(this.editor.Lx(this.x), this.editor.Ly(this.y + 1));
			} else if (this.displayCdc >= this.displayCd / 2 && this.displayCdc < this.displayCd * 3/4) { // 1/4 of the time will have an arrow side to indicate direction
				if (-this.d.x < this.d.y && this.d.y < this.d.x) { // facing right
					ctx.moveTo(this.editor.Lx(this.x), this.editor.Ly(this.y));
					ctx.lineTo(this.editor.Lx(this.x + 0.8), this.editor.Ly(this.y));
					ctx.lineTo(this.editor.Lx(this.x + 1.1), this.editor.Ly(this.y + 0.5));
					ctx.lineTo(this.editor.Lx(this.x + 0.8), this.editor.Ly(this.y + 1));
					ctx.lineTo(this.editor.Lx(this.x), this.editor.Ly(this.y + 1));
				} else if (-this.d.y < this.d.x && this.d.x < this.d.y) { // facing down
					ctx.moveTo(this.editor.Lx(this.x), this.editor.Ly(this.y));
					ctx.lineTo(this.editor.Lx(this.x + 1), this.editor.Ly(this.y));
					ctx.lineTo(this.editor.Lx(this.x + 1), this.editor.Ly(this.y + 0.8));
					ctx.lineTo(this.editor.Lx(this.x + 0.5), this.editor.Ly(this.y + 1.1));
					ctx.lineTo(this.editor.Lx(this.x), this.editor.Ly(this.y + 0.8));
				} else if (this.d.x < this.d.y && this.d.y < -this.d.x) { // facing left
					ctx.moveTo(this.editor.Lx(this.x + 0.2), this.editor.Ly(this.y));
					ctx.lineTo(this.editor.Lx(this.x + 1), this.editor.Ly(this.y));
					ctx.lineTo(this.editor.Lx(this.x + 1), this.editor.Ly(this.y + 1));
					ctx.lineTo(this.editor.Lx(this.x + 0.2), this.editor.Ly(this.y + 1));
					ctx.lineTo(this.editor.Lx(this.x - 0.1), this.editor.Ly(this.y + 0.5));
				} else if (this.d.y < this.d.x && this.d.x < -this.d.y) { // facing up
					ctx.moveTo(this.editor.Lx(this.x), this.editor.Ly(this.y + 0.2));
					ctx.lineTo(this.editor.Lx(this.x + 0.5), this.editor.Ly(this.y - 0.1));
					ctx.lineTo(this.editor.Lx(this.x + 1), this.editor.Ly(this.y + 0.2));
					ctx.lineTo(this.editor.Lx(this.x + 1), this.editor.Ly(this.y + 1));
					ctx.lineTo(this.editor.Lx(this.x), this.editor.Ly(this.y + 1));
				} else {
					ctx.moveTo(this.editor.Lx(this.x), this.editor.Ly(this.y));
					ctx.lineTo(this.editor.Lx(this.x + 1), this.editor.Ly(this.y));
					ctx.lineTo(this.editor.Lx(this.x + 1), this.editor.Ly(this.y + 1));
					ctx.lineTo(this.editor.Lx(this.x), this.editor.Ly(this.y + 1));
				}
			}
			ctx.fill();
		}
	};
	move(d=this.d, showDirection=false) {
		[this.x, this.y] = lineWrapMove(this.x, this.y, d, this.editor.width, this.editor.height);
		if (showDirection) this.displayCdc = this.displayCd / 2;
		else this.displayCdc = 0;
	};
	moveTo(x, y) {
		if (x >= 0 && x < this.editor.width && y >= 0 && y < this.editor.height) {
			this.x = x;
			this.y = y;
		}
		this.displayCdc = this.displayCd / 2;
	};
	type(char) {
		if (this.select.ka) {
			for (let x = this.select.start.x; x <= this.select.end.x; x++) {
				for (let y = this.select.start.y; y <= this.select.end.y; y++) {
					this.editor.data[x + y*this.editor.width] = char.charCodeAt();
				}
			}
		} else {
			this.editor.data[this.x + this.y*this.editor.width] = char.charCodeAt();
			this.move();
		}
		this.displayCdc = 0;
	};
	backspace() {
		this.move([-this.d.x, -this.d.y]);
		this.editor.data[this.x + this.y*this.editor.width] = 32;
	};
	paste(text) {
		if (this.select.ka && text.length == 1) this.type(text); 
		else {
			var X, Y;
			if (this.select.ka) {
				X = this.select.start.x;
				Y = this.select.start.y;
			} else {
				X = this.x;
				Y = this.y;
			}

			const [array, width] = textToArray(text);

			for (let x = 0; x < width; x++) {
				for (let y = 0; y < array.length/width; y++) {
					if (x + X < this.editor.width && y + Y < this.editor.height) this.editor.data[x + X + (y + Y)*this.editor.width] = array[x + y*width];
				}
			}
		}
	};
	getSelectionData() {
		const array = [];
		for (let x = 0; x + this.select.start.x <= this.select.end.x; x++) {
			for (let y = 0; y + this.select.start.y <= this.select.end.y; y++) {
				array[x + y*(this.select.end.x - this.select.start.x + 1)] = this.editor.data[x + this.select.start.x + (y + this.select.start.y)*this.editor.width];
			}
		}
		return array;
	};
	updateSelection() {
		const px1 = floor(this.editor.Px(min(mouse.drag.l.start.x, mouse.drag.l.end.x) + canvas.parentElement.scrollLeft));
		const py1 = floor(this.editor.Py(min(mouse.drag.l.start.y, mouse.drag.l.end.y) + canvas.parentElement.scrollTop));
		const px2 = floor(this.editor.Px(max(mouse.drag.l.start.x, mouse.drag.l.end.x) + canvas.parentElement.scrollLeft));
		const py2 = floor(this.editor.Py(max(mouse.drag.l.start.y, mouse.drag.l.end.y) + canvas.parentElement.scrollTop));
		this.select.start = new V(bind(px1, 0, this.editor.width - 1), bind(py1, 0, this.editor.height - 1));
		this.select.end = new V(bind(px2, 0, this.editor.width - 1), bind(py2, 0, this.editor.height - 1));
	}
	clearSelection() {
		for (let x = this.select.start.x; x <= this.select.end.x; x++) {
			for (let y = this.select.start.y; y <= this.select.end.y; y++) {
				this.editor.data[x + y*this.editor.width] = 32;
			}
		}
	}
	getSelectionWidth() { return this.select.end.x - this.select.start.x + 1; };
	getSelectionHeight() { return this.select.end.y - this.select.start.y + 1; };
};


function lineWrapMove(x, y, d, width, height) {
	d = new V(d);
	x += d.x, y += d.y;
	if (x < 0 || y < 0 || x >= width || y >= height) {
		if (d.x == 0 || d.y == 0) {
			x = round(wrap(x, 0, width));
			y = round(wrap(y, 0, height));
		} else {
			while (!(x < 0 || y < 0 || x >= width || y >= height)) x -= d.x, y -= d.y;
			while (x < 0 || y < 0 || x >= width || y >= height) x -= d.x, y -= d.y;
			x += d.x, y += d.y;
		}
	}
	return [x, y];
};


const editor = new Editor(113, 24);
const interpreter = new Interpreter(editor);
const cursor = new Cursor(editor);


const modeButton = document.getElementById("modeButton");
const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");
const stepButton = document.getElementById("stepButton");
const speedButton = document.getElementById("speedButton");
function setSpeed() {
	let newSpeed = prompt('Enter a new speed in steps per frame:');
	if (newSpeed == "async auto" || newSpeed == "async" || newSpeed == "auto" || newSpeed == "Auto" || newSpeed == "max" || newSpeed == "Max" || newSpeed == "-1") {
		if (confirm("Async auto is kinda bad unless you're running a small program. Like, speed 1 if you're not getting the 60 frames already. Just sayin, you probably don't wanna use it.")) interpreter.speed = -1;
	} else if (parseInt(newSpeed) >= 0) interpreter.speed = parseInt(newSpeed);
	mouse.l = false;
};
const stackDisplay = document.getElementById("stackDisplay");
const output = document.getElementById("output");
stackDisplay.style.width = (window.innerWidth - 315) + "px";
output.style.width = (window.innerWidth - 315) + "px";




function draw() {
	requestAnimationFrame(draw);

	interpreter.runFrame();

	// update button labels
	if (interpreter.speed == -1) speedButton.innerText = "Speed: Async"; else speedButton.innerText = "Speed: " + interpreter.speed;
	if (interpreter.paused) pauseButton.innerText = "Run"; else pauseButton.innerText = "Pause";
	if (editor.mode == "edit") modeButton.innerText = "Mode: Edit"; else modeButton.innerText = "Mode: Run";
	stackDisplay.innerText = interpreter.stack.join(", ");

	// draw the program
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	editor.draw();
	interpreter.draw();
	cursor.draw();
}

console.log("Hello and welcome to my Befunge-98 interpreter! Not all commands may be supported because of the nature of "+
"Javascript. If you want Trefunge, go make a minecraft mod for it or something. I'm not messing with that here. And if you "+
"want Quadrefunge, well, I can't help you with that.");

draw();