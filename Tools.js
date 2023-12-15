class Frame {
	constructor(parent=null, offset=new V(), scale=new V(1, 1)) {
		this.parent = parent;
		if (this.parent == null) {
			this.offset = new V();
			this.matrix = Matrix.identity(2);
		} else {
			this.offset = new V(offset).fix(2);
			this.matrix = new Matrix([2, 2]);
			this.matrix.d[0][0] = scale.x || scale[0] || scale;
			this.matrix.d[1][1] = scale.y || scale[1] || scale;
		}
	};
	zoom(z, v=new V()) {
		// v is point in frame's reference
		this.offset.add(this.outpoint(v, this.parent).mult(1 - z));
		this.matrix = this.matrix.mult(z);
	};
	collectTransform(frame=null) {
		var transform = {
			matrix: new Matrix(this.matrix),
			offset: new V(this.offset)
		};
		for (var currentFrame = this.parent; currentFrame != frame; currentFrame = currentFrame.parent) {
			transform.matrix = currentFrame.matrix.mult(transform.matrix);
			transform.offset = new V(currentFrame.matrix.mult(new Matrix([2, 1], transform.offset.c)).getCol()).add(currentFrame.offset);
		}
		return transform;
	};
	outpoint(v, outframe=null) {
		v = new V(v).setDim(2);
		return v.applyTransform(this.collectTransform(outframe));
	};
	inpoint(v, inframe=null) {
		v = new V(v).fix(2);
		var transform = this.collectTransform(inframe);
		if (transform.matrix.determinant === 0) console.error("Frame.inpoint error: transform determinant is 0", transform.matrix);
		else return v.applyInverseTransform(transform);
	};
	useTransform(ctx) {
		ctx.resetTransform();
		var t = this.collectTransform();
		ctx.transform(t.matrix.d[0][0], t.matrix.d[1][0], t.matrix.d[0][1], t.matrix.d[1][1], t.offset.x, t.offset.y);
	};
	moveTo(v) {
		if (typeof v === "number") this.outpoint(new V(Array.from(arguments))).moveHere();
		else if (v instanceof V) this.outpoint(v).moveHere();
	};
	lineTo(v) {
		if (typeof v === "number") this.outpoint(new V(Array.from(arguments))).lineHere();
		else if (v instanceof V) this.outpoint(v).lineHere();
	};
};


class EventSchedule {
	constructor(tasks=[]) {
		this.targetFPS = 60;
		this.time1 = performance.now();
		this.tasks = tasks;
		this.ranLastFrame = false;
		this.countOverride = true;
		/*
		tasks = [
			{
				function: function to repeat,
				type: ("%", "count", or "to end"),
				time: % of computing time or number of times to run
			}, ...
		]
				The passed function may return true to stop its execution before it is scheduled
		*/
	};
	dontDoTasks() {
		this.time1 = performance.now();
		this.ranLastFrame = false;
	};
	doTasks() { // This will stop executing functions when it expects the next frame to begin
		let endAll;
		let opTime;
		if (this.ranLastFrame) {
			endAll = this.time1 + 1000/this.targetFPS;
			opTime = endAll - performance.now();
		} else {
			opTime = 1000/this.targetFPS;
			endAll = performance.now() + opTime;
		}
		main:
		for (let a = 0; a < this.tasks.length; a++) {
			switch (this.tasks[a].type) {
				case "%":
					if (performance.now() >= endAll) break main;
					const endThis = performance.now() + opTime * this.tasks[a].time;
					while (performance.now() < endAll && performance.now() < endThis && !this.tasks[a].function()) {}
					break;
				case "count":
					if (performance.now() >= endAll && !this.countOverride) break main;
					for (let b = 0; b < this.tasks[a].time && (performance.now() < endAll || this.countOverride) && !this.tasks[a].function(); b++) {}
					break;
				default:
					if (performance.now() >= endAll) break main;
					while (performance.now() < endAll && !this.tasks[a].function()) {c++;}
					break;
			}
		}
		this.time1 = performance.now();
		this.ranLastFrame = true;
	};
};

class FPSMeter {
	constructor(avgSpread=3) {
		this.t = performance.now();
		this.fpsList = [];
		for (let a = 0; a < max(avgSpread, 1); a++) this.fpsList.push(0);
	};
	frame() {
		let t2 = performance.now();
		this.fpsList.push(1000 / (t2 - this.t1));
		this.fpsList.shift();
		this.t1 = t2;
	};
	get fps() {
		this.fpsList.sort((a, b) => a - b);
		return this.fpsList[Math.floor(this.fpsList.length / 2)];
	}
};



const mouse = Object.assign({ // I want mouse to have the methods of V but not the same .r value
    l: false,
	m: false,
	r: false,
    drag: {
        l: { start: new V(), end: new V() },
        m: { start: new V(), end: new V() },
        r: { start: new V(), end: new V() }
	},
	relativeToElement: {offsetLeft: 0, offsetTop: 0}
}, new V(0, 0));
mouse.__proto__ = new V().__proto__;

window.addEventListener("mousemove", function(event) {
	mouse.x = event.x - mouse.relativeToElement.offsetLeft;
	mouse.y = event.y - mouse.relativeToElement.offsetTop;
	if (mouse.l) mouse.drag.l.end = new V(mouse);
    if (mouse.m) mouse.drag.m.end = new V(mouse);
    if (mouse.r) mouse.drag.r.end = new V(mouse);
});

window.addEventListener("mousedown", function(event) {
	switch (event.button) {
	case 0:
		mouse.l = true;
		mouse.drag.l.start = new V(mouse);
		mouse.drag.l.end = new V(mouse);
		break;
	case 1:
        mouse.m = true;
		mouse.drag.m.start = new V(mouse);
		mouse.drag.m.end = new V(mouse);
		break;
	case 2:
        mouse.r = true;
        mouse.drag.r.start = new V(mouse);
		mouse.drag.r.end = new V(mouse);
		break;
	}
});

window.addEventListener("mouseup", function(event) {
	switch (event.button) {
		case 0:
			mouse.l = false;
			break;
		case 1:
			mouse.m = false;
			break;
		case 2:
			mouse.r = false;
			break;
	}
});

var keys = [];
for (var x = 0; x < 256; x++) { keys[x] = false; }
window.addEventListener("keydown", function(event) { keys[event.which || event.keyCode] = true; });
window.addEventListener("keyup", function(event) { keys[event.which || event.keyCode] = false; });






