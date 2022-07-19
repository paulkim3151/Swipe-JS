(()=>{
/* DEBUG FLAGS */
const RANDOM = false; 
const BALL_DEBUG = false; 
const SHOW_BOUND = false; 


/* MAIN CONSTANTS */
const NUM_BRICK_COLUMN = 6;
const MAX_BRICK_STACK = 7;

const THETA_THRESHOLD = 10; // 10deg
const BRICK_GAP_THRESHOLD = 8; // 8px
const FPS = 80; // 80fps; 

const CORNER_LEFT_UP = 0;
const CORNER_LEFT_DOWN = 1;
const CORNER_RIGHT_UP = 2;
const CORNER_RIGHT_DOWN = 3;

const BRICK_COLOR_MAX = 0xff4151;
const BRICK_COLOR_MIN = 0xffbb75;

const container = document.querySelector(".game-container");
const computedStyle = window.getComputedStyle(document.documentElement);
const BRICK_WIDTH = parseInt(computedStyle.getPropertyValue("--brick-width"));
const BRICK_HEIGHT = parseInt(computedStyle.getPropertyValue("--brick-height"));
const BRICK_MARGIN = parseInt(computedStyle.getPropertyValue("--brick-margin"));
const CONTAINER_WIDTH = BRICK_WIDTH * NUM_BRICK_COLUMN + (BRICK_MARGIN * (NUM_BRICK_COLUMN + 1));
const ITEM_RADIUS = parseInt(computedStyle.getPropertyValue("--item-radius"));
const BALL_RADIUS = parseInt(computedStyle.getPropertyValue("--ball-radius"));
const ITEM_COLOR = computedStyle.getPropertyValue("--item-color");

const BALL_INIT_X = CONTAINER_WIDTH / 2;
const BALL_INIT_Y = 550;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

class Game {
	constructor() {
		this.container = document.querySelector(".game-container");
		this.line = document.querySelector(".guideline");
		this.lineWidth = parseInt(window.getComputedStyle(this.line).borderWidth);
		this.gameMouseHandler = this.mouseMoveHandler.bind(this);
		this.gameClickHandler = this.mouseClickHandler.bind(this);
		this.scoreSystem = new ScoreSystem();
		this.particleSystem = new ParticleSystem();
		this.ballCounter = document.createElement('div');
		this.ballCounter.className = "ball-counter";
		this.container.appendChild(this.ballCounter);
		this.initialize();
	}

	initialize() {
		this.maxBallCount = 1;
		this.curBallCount = 0;
		this.ball_speed = 10;
		this.ballAddDelay = 5; // 1 ball per every 5 frame

		this.balls = [];
		this.bricks = [];
		this.theta == 0;
		this.curBrickDurability = 0;
		this.ballAdditionId = null;
		this.animationId = null;
		this.startCoord = { x: BALL_INIT_X, y: BALL_INIT_Y };
		this.nextCoord = { x: BALL_INIT_X, y: BALL_INIT_Y };

		this.bricks = this.initBricks();
		this.balls.push(new Ball(this.ball_speed, 1, 0, this.startCoord.x, this.startCoord.y));
		this.startBall = this.balls[0];
		this.guideball = new Ball(this.ball_speed, 1, 0, this.startCoord.x, this.startCoord.y);
		this.updateBallCounter();
		this.guideball.setHidden();
		this.guideball.setGray();
		this.scoreSystem.updateLB();
		this.startNewTurn();
	}

	initBricks() {
		const bricks = [];
		for (let i = 0; i < MAX_BRICK_STACK; i++) {
			bricks.push(new Array(NUM_BRICK_COLUMN));
		}
		return bricks;
	}

	startNewTurn() {
		if (SHOW_BOUND) { // DEBUG FLAG
			const circles = container.querySelectorAll(".circle");
			circles.forEach(circle => circle.parentElement.removeChild(circle));
			const boxes = container.querySelectorAll(".box");
			boxes.forEach(box => box.parentElement.removeChild(box));
		}

		this.aliveBallCount = 0;
		this.curBallCount = 0;
		this.startCoord = { x: this.nextCoord.x, y: this.nextCoord.y };
		this.updateBallCounter()
		this.curBrickDurability++;

		let isGameover = this.checkGameOver();
		if (!isGameover) {
			this.collectItemsOnBarrier();
		}
		this.movedownBricks();
		this.updateBricksColor();
		this.createNewBrickRow();

		if (isGameover) {
			this.gameOver();
			return;
		}

		this.items = this.getItemArray();
		this.bricks.pop();
		this.scoreSystem.setScore(this.curBrickDurability - 1);

		const ball = this.balls[0];
		this.line.style.left = ball.x + 'px';
		this.line.style.top = (ball.y - this.lineWidth) + 'px';
		this.container.addEventListener("mousemove", this.gameMouseHandler);
		this.container.addEventListener("click", this.gameClickHandler);
	}


	collectItemsOnBarrier() {
		const lastBrickRow = this.bricks[this.bricks.length - 1];
		lastBrickRow.forEach((item, index) => {
			if (item && item.type === "item" && !item.isCollected) {
				item.isCollected = true;
				this.removeItem(item);
				this.maxBallCount++;
				lastBrickRow.splice(index, 1, null);
			}
		});
	}

	gameOver() {
		document.querySelector("#gameover-overlay").classList.remove("hidden")
		this.bricks.forEach(brickRow => {
			brickRow.forEach(brick => {
				if (brick) {
					brick.setGray();
				}
			})
		})
		this.balls.map(ball => ball.setGray());

		const scoreForm = document.querySelector("#scoreForm");
		const inputBox = scoreForm.querySelector("input");
		document.querySelector("#score").innerText = this.scoreSystem.score;
		inputBox.focus();
		inputBox.value = "";
		scoreForm.addEventListener("submit", (e) => {
			e.preventDefault();
			this.scoreSystem.submitScore(inputBox.value, this.scoreSystem.score);
			this.scoreSystem.updateLB();
			scoreForm.parentElement.removeChild(scoreForm);
		}, { once: true });
	}

	movedownBricks() {
		this.bricks.forEach(brickRow => {
			brickRow.forEach(brick => {
				if (brick) {
					brick.movedown()
				}
			})
		})
	}

	updateBricksColor() {
		this.bricks.forEach(brickRow => {
			brickRow.forEach(brick => {
				if (brick && brick.type === "brick") {
					brick.updateColor(this.curBrickDurability);
				}
			})
		})
	}

	createEmptyRow() {
		this.bricks.splice(0, 0, new Array(NUM_BRICK_COLUMN));
	}

	calculateNumberOfBricks() {
		// level = relative probability of [1 brick, 2 bricks, 3 bricks, 4 bricks, 5 bricks]; 
		const level1 = [1, 1, 0, 0, 0];
		const level2 = [1, 3, 2, 0, 0];
		const level3 = [0, 3, 3, 1, 0];
		const level4 = [0, 3, 3, 2, 1];
		const level5 = [0, 2, 3, 3, 1];
		const level6 = [0, 20, 35, 30, 15];
		const level7 = [0, 20, 30, 30, 20];

		let currentlevel = null;
		if (this.curBrickDurability <= 7) {
			currentlevel = level1;
		} else if (this.curBrickDurability <= 15) {
			currentlevel = level2;
		} else if (this.curBrickDurability <= 50) {
			currentlevel = level3;
		} else if (this.curBrickDurability <= 100) {
			currentlevel = level4;
		} else if (this.curBrickDurability <= 200) {
			currentlevel = level5;
		} else if (this.curBrickDurability <= 400) {
			currentlevel = level6;
		} else {
			currentlevel = level7;
		}

		const sum = currentlevel.reduce((prev, cur) => prev + cur);
		let propArr = [];
		let acc = 0;
		currentlevel.forEach(ratio => {
			acc += ratio;
			propArr.push(acc / sum);
		})

		const random = Math.random();
		for (let i = 0; i < propArr.length; i++) {
			if (random < propArr[i]) {
				return i + 1;
			}
		}

	}

	createNewBrickRow() {
		let newBrickRow = [];
		const numNewBricks = this.calculateNumberOfBricks(); // 난이도 조절 부분
		for (let i = 0; i < NUM_BRICK_COLUMN; i++) {
			if (i < numNewBricks) {
				newBrickRow.push(new Brick(i, this.curBrickDurability));
			} else if (i === numNewBricks) {
				newBrickRow.push(new Item(i));
			} else {
				newBrickRow.push(null);
			}
		}

		newBrickRow.sort(() => Math.random() - 0.5);
		newBrickRow.forEach((elem, index) => {
			if (elem) {
				elem.setIndex(index);
			}
		})
		this.bricks.splice(0, 0, newBrickRow);
	}

	removeItem(item) {
		this.bricks.forEach(row => {
			row.forEach((elem, index) => {
				if (elem === item) {
					row.splice(index, 1, null);
				}
			})
		})
		item.remove(this.particleSystem);
	}

	removeBrick(brick) {
		this.bricks.forEach(row => {
			row.forEach((elem, index) => {
				if (elem === brick) {
					row.splice(index, 1, null);
				}
			})
		})
		brick.remove(this.particleSystem);
	}

	checkGameOver() {
		const lastBrickRow = this.bricks[this.bricks.length - 1];
		return lastBrickRow.some(elem => elem && elem.type === "brick");
	}

	calculateTheta(mouseEvent, ball) {
		const mouseX = mouseEvent.clientX;
		const mouseY = mouseEvent.clientY;
		const coord = ball.ballElm.getBoundingClientRect();
		const ballX = coord.left + ball.radius;
		const ballY = coord.top + ball.radius;

		let theta = Math.atan2(ballY - mouseY, ballX - mouseX) + Math.PI;

		// Degree threshold check
		if (!BALL_DEBUG) {
			if (theta > Math.PI / 2 && theta < Math.PI + THETA_THRESHOLD * DEG_TO_RAD) {
				theta = Math.PI + THETA_THRESHOLD * DEG_TO_RAD;
			}
			if ((theta > 0 && theta < Math.PI / 2) || theta > Math.PI * 2 - THETA_THRESHOLD * DEG_TO_RAD) {
				theta = Math.PI * 2 - THETA_THRESHOLD * DEG_TO_RAD;

			}
			return theta;
		}
	}

	removeBounds() {
		const boundElms = container.querySelectorAll(".box");
		boundElms.forEach(boundElm => container.removeChild(boundElm));
		const circleElms = container.querySelectorAll(".circle");
		circleElms.forEach(circleElm => container.removeChild(circleElm));
	}


	mouseMoveHandler(e) {
		this.theta = this.calculateTheta(e, this.balls[0]);
		this.line.classList.remove("hidden");
		this.line.style.transform = `rotate(${this.theta}rad)`;

		this.guideball.theta = this.theta;
		this.guideball.setVisible();
		this.guideball.setBallPosition(this.nextCoord.x, this.nextCoord.y);
		let nearBricks = this.getNearbyBricksFromBall(this.guideball);
		let wallCollide = this.guideball.checkWallCollision();
		let brickCollide = this.guideball.checkBrickCollision(nearBricks).length > 0;
		while (true) {
			if (wallCollide || brickCollide) {
				break;
			}
			this.guideball.moveNextPos();
			this.removeBounds()
			wallCollide = this.guideball.checkWallCollision();
			brickCollide = this.guideball.checkBrickCollision(this.getNearbyBricksFromBall(this.guideball)).length > 0;
		}
		this.guideball.updateBallElm();
	}

	mouseClickHandler(e) {
		this.theta = this.calculateTheta(e, this.balls[0]);
		this.line.style.transform = `rotate(${this.theta}rad)`;
		this.guideball.setHidden();
		this.balls.forEach(ball => {
			ball.theta = this.theta;
		});


		this.line.classList.add("hidden");
		if (e.button === 2 || !BALL_DEBUG) {
			this.nextCoord = null;
			this.container.removeEventListener("mousemove", this.gameMouseHandler);
			this.container.removeEventListener("click", this.gameClickHandler);
			//첫 공 설정 
			this.startBall.removeBall();
			this.balls = [];
			this.addOneBall();

			this.ballAdditionId = setInterval(this.addOneBall.bind(this), this.ballAddDelay * 1000 / FPS);
			this.animationId = setInterval(this.onFrameUpdate.bind(this), 1000 / FPS);
		} else {
			// BALL DEBUGGING 
			this.balls[0].setBallPosition(e.layerX, e.layerY);
			this.balls[0].theta = this.theta;
			this.nextCoord.x = this.balls[0].x;
			this.nextCoord.y = this.balls[0].y;
			this.line.style.left = this.balls[0].x + 'px';
			this.line.style.top = (this.balls[0].y - this.lineWidth) + 'px';
		}
	}

	addOneBall() {
		const offset = RANDOM ? (Math.random() - 0.5) * Math.PI / 6 : 0;

		const damageMax = Math.ceil(this.maxBallCount / 100);
		if (this.curBallCount < this.maxBallCount) {
			let damage = Math.min(damageMax, this.maxBallCount - this.curBallCount);
			this.curBallCount += damage;
			this.aliveBallCount += damage;
			const ball = new Ball(this.ball_speed, damage, this.theta + offset, this.startCoord.x, this.startCoord.y);
			this.balls.push(ball);
		} else {
			clearInterval(this.ballAdditionId);
		}
		this.updateBallCounter();
	}

	getItemArray() {
		const items = [];
		this.bricks.forEach(row => {
			row.forEach(brick => {
				if (brick && brick.type === "item") {
					items.push(brick);
				}
			});
		})
		return items;
	}

	getNearbyBricksFromBall(ball) {
		let ball_idx = -1;
		let ball_idy = -1;
		let bx = ball.x - BRICK_MARGIN;
		let by = ball.y - BRICK_HEIGHT - BRICK_MARGIN;
		let nearBricks = [];
		let nearDirecton = [[-1, -1], [0, -1], [1, -1], [-1, 0], [-1, 1]];
		if (Math.sin(ball.theta) <= 0) {
			if (Math.cos(ball.theta) <= 0) {
				// 3사분면 
				bx += BRICK_MARGIN;
				by += BRICK_MARGIN;
			} else {
				// 4사분면
				by += BRICK_MARGIN;
				nearDirecton = nearDirecton.map(elem => [elem[0] * -1, elem[1]]);
			}
		} else {
			if (Math.cos(ball.theta) <= 0) {
				// 2사분면 
				bx += BRICK_MARGIN;
				nearDirecton = nearDirecton.map(elem => [elem[0], elem[1] * -1]);

			} else {
				// 1사분면 
				nearDirecton = nearDirecton.map(elem => [elem[0] * -1, elem[1] * -1]);
			}
		}
		ball_idx = Math.floor(bx / (BRICK_WIDTH + BRICK_MARGIN));
		ball_idy = Math.floor(by / (BRICK_HEIGHT + BRICK_MARGIN));


		nearDirecton.forEach(direction => {
			let near_idx = ball_idx + direction[0];
			let near_idy = ball_idy + direction[1];
			if (near_idx < 0 || near_idx >= NUM_BRICK_COLUMN) {
				nearBricks.push(null);
				return;
			}

			if (near_idy < 0 || near_idy >= MAX_BRICK_STACK) {
				nearBricks.push(null);
				return;
			}
			if (this.bricks[near_idy][near_idx] && this.bricks[near_idy][near_idx].type === "brick") {
				nearBricks.push(this.bricks[near_idy][near_idx]);
			} else {
				nearBricks.push(null);
			}
		})
		return nearBricks;
	}

	updateBallCounter() {
		const remainBallCount = this.maxBallCount - this.curBallCount;
		if (remainBallCount >= 2) {
			this.ballCounter.style.left = this.startCoord.x + 'px';
			this.ballCounter.style.top = this.startCoord.y + 10 + 'px';
			this.ballCounter.innerHTML = `&times;${remainBallCount}`;
		} else {
			this.ballCounter.innerHTML = "";
		}
	}

	/* Main Routine of Game */
	onFrameUpdate() {
		if (SHOW_BOUND) { // DEBUG FLAG
			this.removeBounds();
		}
		this.balls.forEach((ball, index) => {
			if (ball.alive) {
				const ball_theta = ball.theta;
				const bx = ball.x;
				const by = ball.y;
				const colliedBricks = ball.moveOneStep(this.getNearbyBricksFromBall(ball));
				colliedBricks.forEach(brick => {
					if (brick.isBroken) {
						return;
					}
					brick.hit(ball.damage);
					if (brick.durability <= 0) {
						if (brick.durability < 0) {
							ball.damage = ball.damage + brick.durability;
							const splited_ball = new Ball(ball.speed, Math.abs(brick.durability), ball_theta, bx, by);
							this.balls.push(splited_ball);
						}
						this.removeBrick(brick);
					} else {
						brick.updateColor(this.curBrickDurability);
					}
				})
				this.items.forEach(item => {
					if (!item.isCollected && ball.checkItemCollision(item)) {
						item.isCollected = true;
						this.removeItem(item);
						this.maxBallCount++;
					}
				});

				if (ball.checkFall()) {
					this.aliveBallCount -= ball.damage;
					if (!this.nextCoord) {
						// 처음으로 떨어진 공 
						this.startBall = ball;
						this.nextCoord = { x: ball.x, y: 550 };
						ball.y = 550;
						ball.updateBallElm();
						ball.alive = false;
					} else {
						// 나중에 떨어진 공 
						ball.setFallBall(this.nextCoord.x);
					}
				}
			}
		});

		if (this.aliveBallCount <= 0) {
			// 모든 공이 떨어졌을 시 새로운 턴 시작 
			this.startBall.resetBall();
			this.balls = [this.startBall];
			this.startNewTurn();
			clearInterval(this.animationId);
		}
	}
}

class Ball {
	constructor(speed, damage, theta, initX, initY) {
		this.container = document.querySelector(".game-container");
		this.speed = speed;
		this.theta = theta;
		this.damage = damage;
		this.x = initX;
		this.y = initY;
		this.next_x = null;
		this.next_y = null;
		this.alive = true;
		this.radius = BALL_RADIUS;
		this.ballElm = this.createBallElm();
	}

	resetBall() {
		this.alive = true;
	}

	setBallPosition(x, y) {
		this.x = x;
		this.y = y;
		this.updateBallElm();
	}

	createBallElm() {
		const ballElm = document.createElement('div');
		ballElm.className = "ball";
		ballElm.style.left = this.x + 'px';
		ballElm.style.top = this.y + 'px';
		container.appendChild(ballElm);
		return ballElm;
	}

	getFlipArr() {
		let x_flip = 1;
		let y_flip = 1;

		if (Math.cos(this.theta) <= 0) {
			x_flip = 1;
		} else {
			x_flip = -1;
		}

		if (Math.sin(this.theta) <= 0) {
			y_flip = 1;
		} else {
			y_flip = -1;
		}

		return [x_flip, y_flip];
	}

	moveOneStep(nearbyBricksArr) {
		this.calculateNextPos();
		this.checkWallCollision();
		let colliedBricks = this.checkBrickCollision(nearbyBricksArr);
		this.moveNextPos();
		this.updateBallElm();

		return colliedBricks;
	}

	moveNextPos() {
		this.x = this.next_x;
		this.y = this.next_y;
	}

	calculateNextPos() {
		this.next_x = this.x + this.speed * Math.cos(this.theta);
		this.next_y = this.y + this.speed * Math.sin(this.theta);
	}

	checkWallCollision() {
		let isWallCollided = false;
		if (this.next_x < 0 || this.next_x > CONTAINER_WIDTH) {
			this.theta = Math.PI - this.theta;
			isWallCollided = true;
		}

		if (this.next_y < 0) {
			this.theta = -1 * this.theta;
			isWallCollided = true;
		}
		this.calculateNextPos();

		return isWallCollided;
	}

	checkBrickCollision(nearbyBricksArr) {
		let colliedBricks = [];
		let THETA_THRESHOLD2 = THETA_THRESHOLD * DEG_TO_RAD;
		const reviseTheta = (theta) => {
			let normalizedTheta = theta - Math.floor(theta / (2 * Math.PI)) * 2 * Math.PI;
			if (0 <= normalizedTheta && normalizedTheta < THETA_THRESHOLD2) {
				normalizedTheta = THETA_THRESHOLD2;
			} else if (2 * Math.PI - THETA_THRESHOLD2 <= normalizedTheta && normalizedTheta < 2 * Math.PI) {
				normalizedTheta = 2 * Math.PI - THETA_THRESHOLD2;
			} else if (Math.PI - THETA_THRESHOLD2 <= normalizedTheta && normalizedTheta < Math.PI) {
				normalizedTheta = Math.PI - THETA_THRESHOLD2;
			} else if (Math.PI <= normalizedTheta && normalizedTheta < Math.PI + THETA_THRESHOLD2) {
				normalizedTheta = Math.PI + THETA_THRESHOLD2;
			}
			return normalizedTheta;
		}

		const reflectCorner = (brick, cornerDirection, bx, by, x_flip, y_flip) => {
			const refer_x = (x_flip > 0) ? brick.x : (-1 * brick.x - BRICK_WIDTH);
			const refer_y = (y_flip > 0) ? brick.y : (-1 * brick.y - BRICK_HEIGHT);
			let cornerX = 0;
			let cornerY = 0;
			switch (cornerDirection) {
				case CORNER_LEFT_UP:
					cornerX = refer_x;
					cornerY = refer_y;
					break;
				case CORNER_LEFT_DOWN:
					cornerX = refer_x;
					cornerY = refer_y + BRICK_HEIGHT;
					break;
				case CORNER_RIGHT_UP:
					cornerX = refer_x + BRICK_WIDTH;
					cornerY = refer_y;
					break;
				case CORNER_RIGHT_DOWN:
					cornerX = refer_x + BRICK_WIDTH;
					cornerY = refer_y + BRICK_HEIGHT;
					break;
			}
			let normalAngle = Math.atan2(this.y * y_flip - cornerY, this.x * x_flip - cornerX);
			if (x_flip < 0) {
				normalAngle = Math.PI - normalAngle;
			}
			if (y_flip < 0) {
				normalAngle = -1 * normalAngle;
			}
			this.theta = 2 * normalAngle - this.theta + Math.PI;
			this.theta = reviseTheta(this.theta);
		}

		const [b_upleft, b_up, b_upright, b_left, b_downleft] = nearbyBricksArr;
		const [x_flip, y_flip] = this.getFlipArr();
		const bx = this.next_x;
		const by = this.next_y;

		/* 벽돌 충돌 체크 
		 ** x_flip = 1, y_flip = 1이라고 가정할때,
		 	
		 	[ b_upleft  ] [   b_up   ] [ b_upright ]
		 	[ b_left    ] [ ●Ball● ] 
		 	[ b_downleft]
	
			Ball이 왼쪽 위로 움직이고 있는 상황
		*/
		

		/* □: 빈공간, ■: 벽돌, ●: 공 */
		const caseBit = ((!!b_upleft) << 2) | ((!!b_up) << 1) | (!!b_left);
		switch (caseBit) {
			case 0b000:
				// Ball 주위 벽돌이 없음
				break;
			case 0b001:
				/* □ □ 
				   ■ ● */
				if (b_left.isColliedRightside(bx, by, x_flip, y_flip)) {
					colliedBricks.push(b_left);
					this.theta = Math.PI - this.theta;
				} else if (b_left.isColliedCorner(CORNER_RIGHT_UP, bx, by, x_flip, y_flip)) {
					colliedBricks.push(b_left);
					reflectCorner(b_left, CORNER_RIGHT_UP, bx, by, x_flip, y_flip);
				}
				break;
			case 0b010:
				/* □ ■ 
				   □ ● */
				if (b_up.isColliedDownside(bx, by, x_flip, y_flip)) {
					colliedBricks.push(b_up);
					this.theta = -1 * this.theta;
				} else if (b_up.isColliedCorner(CORNER_LEFT_DOWN, bx, by, x_flip, y_flip)) {
					colliedBricks.push(b_up);
					reflectCorner(b_up, CORNER_LEFT_DOWN, bx, by, x_flip, y_flip);
				}

				break;
			case 0b011:
			case 0b111:
				/* □ ■   또는	 ■ ■
				   ■ ●		 ■ ● */
				const b_up_collied = b_up.isColliedDownside(bx, by, x_flip, y_flip);
				const b_left_collied = b_left.isColliedRightside(bx, by, x_flip, y_flip);
				if (b_up_collied && b_left_collied) {
					colliedBricks.push(b_up, b_left);
					this.theta = -1 * (Math.PI - this.theta);
				} else if (b_up_collied) {
					colliedBricks.push(b_up);
					this.theta = -1 * this.theta;
				} else if (b_left_collied) {
					colliedBricks.push(b_left);
					this.theta = Math.PI - this.theta;
				}
				break;
			case 0b100:
				/* ■ □ 
				   □ ● */
				if (b_upleft.isColliedDownside(bx, by, x_flip, y_flip)) {
					colliedBricks.push(b_upleft);
					this.theta = -1 * this.theta;
				} else if (b_upleft.isColliedRightside(bx, by, x_flip, y_flip)) {
					colliedBricks.push(b_upleft);
					this.theta = Math.PI - this.theta;
				} else if (b_upleft.isColliedCorner(CORNER_RIGHT_DOWN, bx, by, x_flip, y_flip)) {
					colliedBricks.push(b_upleft);
					reflectCorner(b_upleft, CORNER_RIGHT_DOWN, bx, by, x_flip, y_flip);
				}
				break;
			case 0b101:
				/* ■ □ 
				   ■ ● */
				if (b_upleft.isColliedRightsideGap(bx, by, x_flip, y_flip, b_left)) {
					colliedBricks.push(b_upleft, b_left);
					this.theta = Math.PI - this.theta;
				} else if (b_upleft.isColliedRightside(bx, by, x_flip, y_flip)) {
					colliedBricks.push(b_upleft);
					this.theta = Math.PI - this.theta;


				} else if (b_left.isColliedRightside(bx, by, x_flip, y_flip)) {
					colliedBricks.push(b_left);
					this.theta = Math.PI - this.theta;
				}
				break;
			case 0b110:
				/* ■ ■ 
				   □ ● */
				if (b_upleft.isColliedDownsideGap(bx, by, x_flip, y_flip, b_up)) {
					colliedBricks.push(b_upleft, b_up);
					this.theta = -1 * this.theta;
				} else if (b_upleft.isColliedDownside(bx, by, x_flip, y_flip)) {
					colliedBricks.push(b_upleft);
					this.theta = -1 * this.theta;
				} else if (b_up.isColliedDownside(bx, by, x_flip, y_flip)) {
					colliedBricks.push(b_up);
					this.theta = -1 * this.theta;
				}
				break;
		}
		if (b_downleft && !b_left) {
			/* 	 ?  ?
				□ ● 
				■    */
			if (b_downleft.isColliedCorner(CORNER_RIGHT_UP, bx, by, x_flip, y_flip)) {
				colliedBricks.push(b_downleft);
				reflectCorner(b_downleft, CORNER_RIGHT_UP, bx, by, x_flip, y_flip);
			}
		}


		if (b_upright && !b_up) {
			/* 	?  □ ■ 
				?  ●     */
			if (b_upright.isColliedCorner(CORNER_LEFT_DOWN, bx, by, x_flip, y_flip)) {
				colliedBricks.push(b_upright);
				reflectCorner(b_upright, CORNER_LEFT_DOWN, bx, by, x_flip, y_flip);
			}
		}

		this.calculateNextPos();
		return colliedBricks;
	}

	updateBallElm() {
		this.ballElm.style.left = this.x + 'px';
		this.ballElm.style.top = this.y + 'px';
	}

	checkFall() {
		return this.y > 550 && Math.sin(this.theta) > 0;
	}

	setFallBall(x) {
		this.alive = false;
		this.animationId = this.ballElm.animate([
			{
				left: this.x + 'px',
				top: '550px',
				opacity: 1,
				easing: "ease-out"
		},
			{
				left: x + 'px',
				top: '550px',
				opacity: 0
		}], 500);
		this.removeHandler = this.removeBall.bind(this);
		this.animationId.addEventListener("finish", this.removeHandler);
	}


	removeBall(e) {
		if (this.animationId) {
			this.animationId.removeEventListener("finish", this.removeHandler);
		};
		this.container.removeChild(this.ballElm);
	}

	checkItemCollision(item) {
		const distance2 = Math.pow(item.x - this.x, 2) + Math.pow(item.y - this.y, 2);
		if (distance2 < Math.pow(BALL_RADIUS + ITEM_RADIUS, 2)) {
			return true;
		} else {
			return false;
		}
	}

	setHidden() {
		this.ballElm.classList.add("hidden");
	}

	setVisible() {
		this.ballElm.classList.remove("hidden");
	}

	setGray() {
		this.ballElm.style.backgroundColor = "lightgray";
	}
}

class Brick {
	constructor(index_x, durability) {
		this.x = BRICK_MARGIN + index_x * (BRICK_WIDTH + BRICK_MARGIN);
		this.y = BRICK_MARGIN + BRICK_HEIGHT;
		this.durability = durability;
		this.type = "brick";
		this.brickElm = this.createBrickElm();
		this.isBroken = false;
	}

	createBrickElm() {
		const brickElm = document.createElement('div');
		brickElm.innerText = this.durability;
		brickElm.className = "brick";
		brickElm.style.left = this.x + 'px';
		brickElm.style.top = this.y + 'px';
		brickElm.style.backgroundColor = '#' + (BRICK_COLOR_MAX).toString(16);
		container.appendChild(brickElm);
		return brickElm;
	}

	setIndex(index_x) {
		this.x = BRICK_MARGIN + index_x * (BRICK_WIDTH + BRICK_MARGIN);
		this.brickElm.style.left = this.x + 'px';
	}

	movedown() {
		this.y += BRICK_MARGIN + BRICK_HEIGHT;
		this.brickElm.style.top = this.y + 'px';
	}
	createBoundBox(bound_x, bound_y) {
		bound_x = bound_x.map(e => Math.abs(e));
		bound_y = bound_y.map(e => Math.abs(e));
		const boundElm = document.createElement('div');
		boundElm.className = "box";
		boundElm.style.left = Math.min.apply(null, bound_x) + 'px';
		boundElm.style.top = Math.min.apply(null, bound_y) + 'px';
		boundElm.style.width = Math.abs(bound_x[1] - bound_x[0]) + 'px';
		boundElm.style.height = Math.abs(bound_y[1] - bound_y[0]) + 'px';
		container.appendChild(boundElm);
		return boundElm;
	}

	createBoundCircle(x, y) {
		const boundElm = document.createElement('div');
		boundElm.className = "circle";
		boundElm.style.left = x + 'px';
		boundElm.style.top = y + 'px';
		container.appendChild(boundElm);
		return boundElm;
	}

	isColliedDownside(bx, by, x_flip, y_flip) {
		if (this.isBroken) {
			return false;
		}

		const refer_x = (x_flip > 0) ? this.x : (-1 * this.x - BRICK_WIDTH);
		const refer_y = (y_flip > 0) ? this.y : (-1 * this.y - BRICK_HEIGHT);
		let bound_x = [refer_x, refer_x + BRICK_WIDTH];
		let bound_y = [refer_y + BRICK_HEIGHT, refer_y + BRICK_HEIGHT + BALL_RADIUS];
		if (SHOW_BOUND) { // DEBUG FLAG
			this.createBoundBox(bound_x, bound_y)
		}

		bx *= x_flip;
		by *= y_flip;
		if (bound_x[0] < bx && bx < bound_x[1]) {
			if (bound_y[0] < by && by < bound_y[1]) {
				return true;
			}
		}

		return false;
	}

	isColliedDownsideGap(bx, by, x_flip, y_flip, b_left) {
		if (this.isBroken || b_left.isBroken) {
			return false;
		}

		const refer_x = (x_flip > 0) ? this.x : (-1 * this.x - BRICK_WIDTH);
		const refer_y = (y_flip > 0) ? this.y : (-1 * this.y - BRICK_HEIGHT);
		const gap_centerX = refer_x + BRICK_WIDTH + BRICK_MARGIN / 2;
		let bound_x = [gap_centerX - BRICK_GAP_THRESHOLD / 2, gap_centerX + BRICK_GAP_THRESHOLD / 2];
		let bound_y = [refer_y + BRICK_HEIGHT, refer_y + BRICK_HEIGHT + BALL_RADIUS];
		if (SHOW_BOUND) { // DEBUG FLAG
			this.createBoundBox(bound_x, bound_y)
		}

		bx *= x_flip;
		by *= y_flip;
		if (bound_x[0] < bx && bx < bound_x[1]) {
			if (bound_y[0] < by && by < bound_y[1]) {
				return true;
			}
		}
		return false;
	}

	isColliedRightside(bx, by, x_flip, y_flip) {
		if (this.isBroken) {
			return false;
		}

		const refer_x = (x_flip > 0) ? this.x : -1 * this.x - BRICK_WIDTH;
		const refer_y = (y_flip > 0) ? this.y : -1 * this.y - BRICK_HEIGHT;
		let bound_x = [refer_x + BRICK_WIDTH, refer_x + BRICK_WIDTH + BALL_RADIUS];
		let bound_y = [refer_y, refer_y + BRICK_HEIGHT];
		if (SHOW_BOUND) { // DEBUG FLAG
			this.createBoundBox(bound_x, bound_y)
		}

		bx *= x_flip;
		by *= y_flip;
		if (bound_x[0] < bx && bx < bound_x[1]) {
			if (bound_y[0] < by && by < bound_y[1]) {
				return true;
			}
		}
		return false;
	}

	isColliedRightsideGap(bx, by, x_flip, y_flip, b_down) {
		if (this.isBroken || b_down.isBroken) {
			return false;
		}

		const refer_x = (x_flip > 0) ? this.x : -1 * this.x - BRICK_WIDTH;
		const refer_y = (y_flip > 0) ? this.y : -1 * this.y - BRICK_HEIGHT;
		const gap_centerY = refer_y + BRICK_HEIGHT + BRICK_MARGIN / 2;
		let bound_x = [refer_x + BRICK_WIDTH, refer_x + BRICK_WIDTH + BALL_RADIUS];
		let bound_y = [gap_centerY - BRICK_GAP_THRESHOLD / 2, gap_centerY + BRICK_GAP_THRESHOLD / 2];
		if (SHOW_BOUND) { // DEBUG FLAG
			this.createBoundBox(bound_x, bound_y)
		}

		bx *= x_flip;
		by *= y_flip;
		if (bound_x[0] < bx && bx < bound_x[1]) {
			if (bound_y[0] < by && by < bound_y[1]) {
				return true;
			}
		}
		return false;
	}

	isColliedCorner(cornerDirection, bx, by, x_flip, y_flip) {
		if (this.isBroken) {
			return false;
		}
		const refer_x = (x_flip > 0) ? this.x : -1 * this.x - BRICK_WIDTH;
		const refer_y = (y_flip > 0) ? this.y : -1 * this.y - BRICK_HEIGHT;
		bx *= x_flip;
		by *= y_flip;
		let cornerX = 0;
		let cornerY = 0;
		let areaCheck = false;
		switch (cornerDirection) {
			case CORNER_LEFT_UP:
				cornerX = refer_x;
				cornerY = refer_y;
				areaCheck = cornerX > bx && cornerY > by;
				break;
			case CORNER_LEFT_DOWN:
				cornerX = refer_x;
				cornerY = refer_y + BRICK_HEIGHT;
				areaCheck = cornerX > bx && cornerY < by;
				break;
			case CORNER_RIGHT_UP:
				cornerX = refer_x + BRICK_WIDTH;
				cornerY = refer_y;
				areaCheck = cornerX < bx && cornerY > by;
				break;
			case CORNER_RIGHT_DOWN:
				cornerX = refer_x + BRICK_WIDTH;
				cornerY = refer_y + BRICK_HEIGHT;
				areaCheck = cornerX < bx && cornerY < by;
				break;
		}
		if (SHOW_BOUND) { // DEBUG FLAG
			this.createBoundCircle(Math.abs(cornerX), Math.abs(cornerY));
		}
		if (areaCheck) {
			if (Math.pow(bx - cornerX, 2) + Math.pow(by - cornerY, 2) < BALL_RADIUS * BALL_RADIUS) {
				return true;
			}
		}
		return false;
	}

	updateColor(maxDurability) {
		if (this.durability <= 0) {
			return;
		}
		const calcultateColorByPercent = (percent) => {
			const red = [BRICK_COLOR_MIN & 0xff0000, BRICK_COLOR_MAX & 0xff0000];
			const green = [BRICK_COLOR_MIN & 0x00ff00, BRICK_COLOR_MAX & 0x00ff00];
			const blue = [BRICK_COLOR_MIN & 0x0000ff, BRICK_COLOR_MAX & 0x0000ff];

			const red_color = Math.floor(percent * red[1] + (1 - percent) * red[0]);
			const green_color = Math.floor(percent * green[1] + (1 - percent) * green[0]);
			const blue_color = Math.floor(percent * blue[1] + (1 - percent) * blue[0]);
			return '#' + ((red_color & 0xff0000) | (green_color & 0x00ff00) | blue_color).toString(16).padStart(6, '0');
		}

		const colorCode = calcultateColorByPercent((this.durability - 1) / (maxDurability - 1));
		this.brickElm.style.backgroundColor = colorCode;
	}

	hit(damage) {
		this.brickElm.animate([
			{
				opacity: 1
 		},
			{
				opacity: 0.5,
				offset: 0.5
 		},
			{
				opacity: 1
 		}], 150);
		this.durability -= damage;
		this.brickElm.innerText = this.durability;
	}

	remove(particleSystem) {
		particleSystem.createParticlesFromBrick(this);
		this.isBroken = true;
		this.brickElm.parentElement.removeChild(this.brickElm);
	}

	setGray() {
		this.brickElm.style.backgroundColor = "gray";
	}

	getColor() {
		return this.brickElm.style.backgroundColor;
	}

}

class Item {
	constructor(index_x) {
		this.x = BRICK_MARGIN + index_x * (BRICK_WIDTH + BRICK_MARGIN) + BRICK_WIDTH / 2;
		this.y = BRICK_MARGIN + BRICK_HEIGHT + BRICK_HEIGHT / 2;
		this.type = "item";
		this.isCollected = false;
		this.itemElm = this.createItemElm();
	}

	createItemElm() {
		const itemElm = document.createElement('div');
		itemElm.className = "item";
		itemElm.style.left = (this.x - ITEM_RADIUS) + 'px';
		itemElm.style.top = (this.y - ITEM_RADIUS) + 'px';

		container.appendChild(itemElm);
		return itemElm;
	}

	setIndex(index_x) {
		this.x = BRICK_MARGIN + index_x * (BRICK_WIDTH + BRICK_MARGIN) + BRICK_WIDTH / 2;
		this.itemElm.style.left = (this.x - ITEM_RADIUS) + 'px';
	}

	movedown() {
		this.y += BRICK_MARGIN + BRICK_HEIGHT;
		this.itemElm.style.top = (this.y - ITEM_RADIUS) + 'px';
	}

	remove(particleSystem) {
		particleSystem.createParticlesFromItem(this);
		this.itemElm.parentElement.removeChild(this.itemElm);
	}

	setGray() {
		this.itemElm.style.backgroundColor = "gray";
	}

	getColor() {
		return ITEM_COLOR;
	}
}

class ScoreSystem {
	constructor() {
		const savedLeaderBoard = this.getSavedScore();
		this.leaderBoard = savedLeaderBoard ? JSON.parse(savedLeaderBoard) : [];
		this.score = 0;
		this.scoreElm = document.querySelector('.score');
		this.scoreElm.innerHTML = `현재 기록: ${this.score}`;
		this.LB_MAX = 11;
	}

	setScore(score) {
		this.score = score;
		this.scoreElm.innerHTML = `현재 기록: ${this.score}`;
	}

	submitScore(name, score) {
		this.leaderBoard.push({ name, score, time: Date.now() });
		this.leaderBoard.sort((a, b) => {
			if (a.score === b.score) {
				return a.time - b.time;
			} else {
				return b.score - a.score;
			}
		});
		localStorage.setItem("Swipe", JSON.stringify(this.leaderBoard));
		this.updateLB();
	}

	updateLB() {
		const lb_month = document.querySelector("#lb-month .lb_content");
		let curItem = lb_month.firstElementChild;
		let nowDate = new Date(Date.now());

		// 이달의 기록
		let leaderBoardMonth = this.leaderBoard.filter(elem => {
			let elemDate = new Date(elem.time);
			return nowDate.getYear() === elemDate.getYear() && nowDate.getMonth() === elemDate.getMonth();
		});
		if (leaderBoardMonth.length === 0) {
			curItem.classList.remove("hidden");
		} else {
			curItem.classList.add("hidden");
		}
		let i = 0;
		leaderBoardMonth.forEach(elem => {
			if (i >= this.LB_MAX) {
				return;
			}
			let nextltem = curItem.nextElementSibling;
			if (nextltem === null) {
				nextltem = this.createLB_Elm();
				lb_month.appendChild(nextltem);
			}
			nextltem.querySelector(".num").innerText = i + 1;
			nextltem.querySelector(".name").innerText = elem.name;
			nextltem.querySelector(".score").innerText = elem.score;
			curItem = nextltem;
			i += 1;
		});

		// 명예의 전당
		const lb_global = document.querySelector("#lb-global .lb_content");
		curItem = lb_global.firstElementChild;
		this.leaderBoard.forEach((elem, index) => {
			if (index >= 5) {
				return;
			}
			curItem.querySelector(".name").innerText = elem.name;
			curItem.querySelector(".score").innerText = elem.score;
			curItem = curItem.nextElementSibling;
		})
	}

	createLB_Elm() {
		const lb = document.createElement("div")
		lb.className = "lb_item";
		const innerNum = document.createElement("div");
		innerNum.className = "num";
		const innerName = document.createElement("div");
		innerName.className = "name";
		const innerScore = document.createElement("div");
		innerScore.className = "score";
		lb.append(innerNum, innerName, innerScore);
		return lb;
	}

	getSavedScore() {
		return localStorage.getItem('Swipe');
	}

}

class ParticleSystem {
	constructor() {}
	createParticlesFromBrick(brick) {
		for (let i = 0; i < 16; i++) {
			const particle = new Particle("brick", brick.x, brick.y, i, brick.getColor());
			particle.startAnimation();
		}
	}

	createParticlesFromItem(item) {
		for (let i = 0; i < 16; i++) {
			const particle = new Particle("item", item.x, item.y, i, item.getColor());
			particle.startAnimation();
		}
	}
}

class Particle {
	constructor(type, x, y, i, color) {
		this.container = document.querySelector(".game-container");
		this.type = type;
		this.removeHandler = this.removeParticle.bind(this);
		if (type === "brick") {
			this.partElm = this.createBrickParticleElm(x, y, i, color)
		} else {
			this.partElm = this.createItemParticleElm(x, y, i, color)
		}
	}

	createBrickParticleElm(x, y, i, color) {
		const partElm = document.createElement('div');
		partElm.className = "particle-brick";
		partElm.style.left = (x + parseInt(i % 4) * (BRICK_WIDTH / 4)) + 'px';
		partElm.style.top = (y + parseInt(i / 4) * (BRICK_HEIGHT / 4)) + 'px';
		partElm.style.backgroundColor = color;
		this.container.appendChild(partElm);
		return partElm;
	}
	createItemParticleElm(x, y, i, color) {
		const theta = 2 * Math.PI * i / 16;
		const partElm = document.createElement('div');
		partElm.className = "particle-item";
		partElm.style.left = (x + ITEM_RADIUS * Math.cos(theta)) + 'px';
		partElm.style.top = (y + ITEM_RADIUS * Math.sin(theta)) + 'px';
		partElm.style.backgroundColor = color;
		this.container.appendChild(partElm);
		return partElm;
	}

	removeParticle() {
		this.removed = true;
		this.animationId.removeEventListener("finish", this.removeHandler);
		this.container.removeChild(this.partElm);
	}

	startAnimation() {
		this.isAnimating = true;
		this.animationId = this.partElm.animate([
			{
				opacity: 1,
				transform: "translate(0px, 0px)",
				easing: "cubic-bezier(0.55, 0.09, 0.68, 0.53)"
 	},
			{
				opacity: 0,
				transform: `translate(${Math.random() * 50 - 25}px, ${150+parseInt(Math.random()*50)}px`
	 	},
	 	], Math.floor(60 * 1000 / FPS));
		this.animationId.addEventListener("finish", this.removeHandler);
	}

}

const game = new Game();
})()