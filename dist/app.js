(() => {
  "use strict";

  const canvas = document.querySelector("#cubeCanvas");
  const context = canvas.getContext("2d");

  const DURATION = 12.6;
  const INTRO = 0.48;
  const MOVE_LENGTH = 0.78;
  const colors = {
    px: "#ef7137",
    nx: "#d94338",
    py: "#f4ad34",
    ny: "#f5f1e8",
    pz: "#2f6a54",
    nz: "#244f99",
    core: "#25231f",
    edge: "#a49e94",
    paper: "#fbf8f1",
    ink: "#181714",
  };

  const scramble = [
    ["y", 1, 1],
    ["x", -1, -1],
    ["z", 1, 1],
    ["y", -1, -1],
    ["x", 1, 1],
    ["z", -1, -1],
    ["y", 1, -1],
    ["x", 0, 1],
    ["z", 1, -1],
    ["y", -1, 1],
    ["x", 1, -1],
  ];
  const solveMoves = scramble
    .slice()
    .reverse()
    .map(([axis, layer, direction]) => [axis, layer, -direction]);
  const SOLVE_END = INTRO + solveMoves.length * MOVE_LENGTH;

  let cssWidth = 1280;
  let cssHeight = 720;
  let elapsed = 0;
  let lastTimestamp = null;

  const directionKeys = ["px", "nx", "py", "ny", "pz", "nz"];
  const directionVectors = {
    px: [1, 0, 0],
    nx: [-1, 0, 0],
    py: [0, 1, 0],
    ny: [0, -1, 0],
    pz: [0, 0, 1],
    nz: [0, 0, -1],
  };

  function cloneVector(vector) {
    return [vector[0], vector[1], vector[2]];
  }

  function createSolvedCube() {
    const cubies = [];
    let stickerId = 0;

    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          const faces = directionKeys.map((key) => {
            const direction = cloneVector(directionVectors[key]);
            const visible =
              (key === "px" && x === 1) ||
              (key === "nx" && x === -1) ||
              (key === "py" && y === 1) ||
              (key === "ny" && y === -1) ||
              (key === "pz" && z === 1) ||
              (key === "nz" && z === -1);
            return {
              direction,
              color: visible ? colors[key] : colors.core,
              stickerId: visible ? stickerId++ : null,
              homeFace: key,
            };
          });
          cubies.push({ position: [x, y, z], faces });
        }
      }
    }

    return cubies;
  }

  function cloneCube(cube) {
    return cube.map((cubie) => ({
      position: cloneVector(cubie.position),
      faces: cubie.faces.map((face) => ({ ...face, direction: cloneVector(face.direction) })),
    }));
  }

  function rotateVector(vector, axis, angle) {
    const [x, y, z] = vector;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);

    if (axis === "x") {
      return [x, y * cosine - z * sine, y * sine + z * cosine];
    }
    if (axis === "y") {
      return [x * cosine + z * sine, y, -x * sine + z * cosine];
    }
    return [x * cosine - y * sine, x * sine + y * cosine, z];
  }

  function roundVector(vector) {
    return vector.map((value) => Math.round(value));
  }

  function applyMove(cube, move) {
    const [axis, layer, direction] = move;
    const axisIndex = { x: 0, y: 1, z: 2 }[axis];
    const angle = direction * Math.PI * 0.5;

    cube.forEach((cubie) => {
      if (Math.round(cubie.position[axisIndex]) !== layer) return;
      cubie.position = roundVector(rotateVector(cubie.position, axis, angle));
      cubie.faces.forEach((face) => {
        face.direction = roundVector(rotateVector(face.direction, axis, angle));
      });
    });
  }

  const initialCube = createSolvedCube();
  scramble.forEach((move) => applyMove(initialCube, move));

  function easeInOut(value) {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped < 0.5
      ? 4 * clamped * clamped * clamped
      : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
  }

  function animationState(time) {
    const localTime = Math.max(0, time - INTRO);
    const completedMoves = Math.min(solveMoves.length, Math.floor(localTime / MOVE_LENGTH));
    const cube = cloneCube(initialCube);

    for (let index = 0; index < completedMoves; index += 1) {
      applyMove(cube, solveMoves[index]);
    }

    const activeMove = completedMoves < solveMoves.length ? solveMoves[completedMoves] : null;
    const moveFraction = activeMove
      ? easeInOut((localTime - completedMoves * MOVE_LENGTH) / (MOVE_LENGTH * 0.82))
      : 0;
    const progress = Math.min(
      1,
      (completedMoves + (activeMove ? moveFraction : 0)) / solveMoves.length,
    );
    const reviewProgress = Math.max(
      0,
      Math.min(1, (time - SOLVE_END) / Math.max(0.001, DURATION - SOLVE_END)),
    );

    return { cube, activeMove, moveFraction, completedMoves, progress, reviewProgress };
  }

  function cameraPoint(point, yaw, pitch) {
    const [x, y, z] = point;
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
    const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
    return [x1, -y2, z2];
  }

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  function normalize(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return vector.map((value) => value / length);
  }

  function faceCorners(center, normal, size) {
    const reference = Math.abs(normal[1]) > 0.8 ? [1, 0, 0] : [0, 1, 0];
    const tangentA = normalize(cross(normal, reference));
    const tangentB = normalize(cross(normal, tangentA));
    const half = size * 0.5;
    return [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([a, b]) => [
      center[0] + tangentA[0] * half * a + tangentB[0] * half * b,
      center[1] + tangentA[1] * half * a + tangentB[1] * half * b,
      center[2] + tangentA[2] * half * a + tangentB[2] * half * b,
    ]);
  }

  function polygon(points, fill, stroke, lineWidth = 1) {
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index][0], points[index][1]);
    }
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = lineWidth;
      context.lineJoin = "round";
      context.stroke();
    }
  }

  function drawCube(state, originX, originY, scale) {
    const orbitAngle = state.reviewProgress * Math.PI * 2;
    const cameraYaw = -0.69 - orbitAngle;
    const cameraPitch = 0.52 + Math.sin(orbitAngle) * 0.2;
    const viewDirection = [
      -Math.sin(cameraYaw) * Math.cos(cameraPitch),
      Math.sin(cameraPitch),
      Math.cos(cameraYaw) * Math.cos(cameraPitch),
    ];
    const renderedFaces = [];
    const axisIndex = state.activeMove ? { x: 0, y: 1, z: 2 }[state.activeMove[0]] : -1;
    const activeAngle = state.activeMove
      ? state.activeMove[2] * Math.PI * 0.5 * state.moveFraction
      : 0;

    state.cube.forEach((cubie) => {
      const isActive =
        state.activeMove && Math.round(cubie.position[axisIndex]) === state.activeMove[1];
      const position = isActive
        ? rotateVector(cubie.position, state.activeMove[0], activeAngle)
        : cubie.position;

      cubie.faces.forEach((face) => {
        const normal = isActive
          ? rotateVector(face.direction, state.activeMove[0], activeAngle)
          : face.direction;
        if (dot(normal, viewDirection) <= 0.08) return;

        const center = [
          position[0] + normal[0] * 0.505,
          position[1] + normal[1] * 0.505,
          position[2] + normal[2] * 0.505,
        ];
        const worldCorners = faceCorners(center, normal, 0.91);
        const cameraCorners = worldCorners.map((point) => cameraPoint(point, cameraYaw, cameraPitch));
        const depth = cameraCorners.reduce((sum, point) => sum + point[2], 0) / 4;
        const points = cameraCorners.map((point) => [
          originX + point[0] * scale,
          originY + point[1] * scale,
        ]);
        renderedFaces.push({ points, depth, color: face.color });
      });
    });

    renderedFaces.sort((a, b) => a.depth - b.depth);
    renderedFaces.forEach((face) => {
      polygon(face.points, "#d8d4cc", colors.edge, Math.max(0.7, scale * 0.008));
      const center = face.points.reduce(
        (sum, point) => [sum[0] + point[0] / 4, sum[1] + point[1] / 4],
        [0, 0],
      );
      const inset = face.points.map((point) => [
        center[0] + (point[0] - center[0]) * 0.82,
        center[1] + (point[1] - center[1]) * 0.82,
      ]);
      polygon(inset, face.color, "rgba(255,255,255,0.82)", Math.max(1, scale * 0.012));
    });
  }

  const graphFaceAngles = {
    nx: -Math.PI * 5 / 6,
    py: -Math.PI / 2,
    nz: -Math.PI / 6,
    px: Math.PI / 6,
    ny: Math.PI / 2,
    pz: Math.PI * 5 / 6,
  };

  const graphFaceOrder = ["nx", "py", "nz", "px", "ny", "pz"];
  const faceFrames = {
    px: { normal: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0] },
    nx: { normal: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0] },
    py: { normal: [0, 1, 0], right: [1, 0, 0], down: [0, 0, 1] },
    ny: { normal: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1] },
    pz: { normal: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] },
    nz: { normal: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0] },
  };

  function faceKeyForNormal(normal) {
    const [x, y, z] = normal;
    if (Math.abs(x) >= Math.abs(y) && Math.abs(x) >= Math.abs(z)) return x >= 0 ? "px" : "nx";
    if (Math.abs(y) >= Math.abs(z)) return y >= 0 ? "py" : "ny";
    return z >= 0 ? "pz" : "nz";
  }

  function graphSlotPoint(faceKey, row, column, centerX, centerY, radius) {
    const angle = graphFaceAngles[faceKey];
    const spacing = radius * 0.087;
    return [
      centerX + Math.cos(angle) * radius * 0.58 + column * spacing,
      centerY + Math.sin(angle) * radius * 0.52 + row * spacing,
    ];
  }

  function stickerSlot(position, normal, centerX, centerY, radius) {
    const faceKey = faceKeyForNormal(normal);
    const frame = faceFrames[faceKey];
    const row = Math.max(-1, Math.min(1, Math.round(dot(position, frame.down))));
    const column = Math.max(-1, Math.min(1, Math.round(dot(position, frame.right))));
    return {
      faceKey,
      row,
      column,
      point: graphSlotPoint(faceKey, row, column, centerX, centerY, radius),
    };
  }

  function createGraphTopology() {
    const slots = [];
    const edges = [];

    graphFaceOrder.forEach((faceKey) => {
      const frame = faceFrames[faceKey];
      for (let row = -1; row <= 1; row += 1) {
        for (let column = -1; column <= 1; column += 1) {
          const worldPosition = [0, 1, 2].map(
            (axis) => frame.normal[axis] + frame.right[axis] * column + frame.down[axis] * row,
          );
          slots.push({ faceKey, row, column, worldPosition });
          if (column < 1) {
            edges.push({
              type: "face",
              from: { faceKey, row, column },
              to: { faceKey, row, column: column + 1 },
            });
          }
          if (row < 1) {
            edges.push({
              type: "face",
              from: { faceKey, row, column },
              to: { faceKey, row: row + 1, column },
            });
          }
        }
      }
    });

    const slotsByCubie = new Map();
    slots.forEach((slot) => {
      const key = slot.worldPosition.join(",");
      if (!slotsByCubie.has(key)) slotsByCubie.set(key, []);
      slotsByCubie.get(key).push(slot);
    });

    slotsByCubie.forEach((group) => {
      for (let first = 0; first < group.length; first += 1) {
        for (let second = first + 1; second < group.length; second += 1) {
          const from = group[first];
          const to = group[second];
          edges.push({
            type: "seam",
            from: { faceKey: from.faceKey, row: from.row, column: from.column },
            to: { faceKey: to.faceKey, row: to.row, column: to.column },
          });
        }
      }
    });

    return { slots, edges };
  }

  const graphTopology = createGraphTopology();

  function drawTopologyEdge(edge, centerX, centerY, radius) {
    const from = graphSlotPoint(
      edge.from.faceKey,
      edge.from.row,
      edge.from.column,
      centerX,
      centerY,
      radius,
    );
    const to = graphSlotPoint(
      edge.to.faceKey,
      edge.to.row,
      edge.to.column,
      centerX,
      centerY,
      radius,
    );

    context.beginPath();
    context.moveTo(from[0], from[1]);
    if (edge.type === "seam") {
      const middleX = (from[0] + to[0]) * 0.5;
      const middleY = (from[1] + to[1]) * 0.5;
      context.quadraticCurveTo(
        centerX + (middleX - centerX) * 0.42,
        centerY + (middleY - centerY) * 0.42,
        to[0],
        to[1],
      );
    } else {
      context.lineTo(to[0], to[1]);
    }
    context.strokeStyle = edge.type === "seam" ? "rgba(24, 23, 20, 0.28)" : "rgba(24, 23, 20, 0.5)";
    context.lineWidth = edge.type === "seam" ? Math.max(0.8, radius * 0.006) : Math.max(1, radius * 0.008);
    context.stroke();
  }

  function drawGraph(state, centerX, centerY, radius) {
    context.save();
    context.lineWidth = Math.max(0.8, radius * 0.006);
    context.strokeStyle = "rgba(24, 23, 20, 0.18)";

    for (let ring = 0; ring < 5; ring += 1) {
      context.beginPath();
      context.arc(centerX, centerY, radius * (0.34 + ring * 0.13), 0, Math.PI * 2);
      context.stroke();
    }

    for (let lobe = 0; lobe < 3; lobe += 1) {
      const angle = -Math.PI * 0.5 + (Math.PI * 2 * lobe) / 3;
      context.beginPath();
      context.arc(
        centerX + Math.cos(angle) * radius * 0.24,
        centerY + Math.sin(angle) * radius * 0.24,
        radius * 0.57,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }

    graphTopology.edges.forEach((edge) => drawTopologyEdge(edge, centerX, centerY, radius));

    const nodeRadius = Math.max(3.8, radius * 0.035);
    const axisIndex = state.activeMove ? { x: 0, y: 1, z: 2 }[state.activeMove[0]] : -1;
    const nodes = [];

    state.cube.forEach((cubie) => {
      const isActive =
        state.activeMove && Math.round(cubie.position[axisIndex]) === state.activeMove[1];

      cubie.faces.forEach((face) => {
        if (face.stickerId === null) return;
        const startSlot = stickerSlot(cubie.position, face.direction, centerX, centerY, radius);
        let endSlot = startSlot;

        if (isActive) {
          const finalAngle = state.activeMove[2] * Math.PI * 0.5;
          const finalPosition = rotateVector(cubie.position, state.activeMove[0], finalAngle);
          const finalNormal = rotateVector(face.direction, state.activeMove[0], finalAngle);
          endSlot = stickerSlot(finalPosition, finalNormal, centerX, centerY, radius);
        }

        nodes.push({
          x: startSlot.point[0] + (endSlot.point[0] - startSlot.point[0]) * state.moveFraction,
          y: startSlot.point[1] + (endSlot.point[1] - startSlot.point[1]) * state.moveFraction,
          color: face.color,
        });
      });
    });

    nodes.forEach(({ x, y, color }) => {
      context.beginPath();
      context.arc(x, y, nodeRadius, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      context.strokeStyle = colors.ink;
      context.lineWidth = Math.max(1.1, radius * 0.009);
      context.stroke();
    });
    context.restore();
  }

  function drawDivider() {
    context.strokeStyle = "rgba(24, 23, 20, 0.12)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(cssWidth * 0.5, cssHeight * 0.15);
    context.lineTo(cssWidth * 0.5, cssHeight * 0.83);
    context.stroke();
  }

  function drawFrame(time) {
    const state = animationState(time);
    context.clearRect(0, 0, cssWidth, cssHeight);

    const compact = cssWidth < 650;
    const cubeScale = compact ? cssWidth * 0.102 : cssWidth * 0.072;
    const graphRadius = compact ? cssWidth * 0.19 : cssWidth * 0.14;
    const verticalCenter = cssHeight * 0.48;

    drawDivider();
    drawCube(state, cssWidth * 0.21, verticalCenter, cubeScale);
    drawGraph(state, cssWidth * 0.7, verticalCenter, graphRadius);
  }

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    cssWidth = Math.max(320, Math.round(bounds.width));
    cssHeight = Math.round(cssWidth * 9 / 16);
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawFrame(elapsed);
  }

  function tick(timestamp) {
    if (lastTimestamp !== null) {
      elapsed += (timestamp - lastTimestamp) / 1000;
    }
    if (elapsed >= DURATION) elapsed %= DURATION;
    lastTimestamp = timestamp;
    drawFrame(elapsed);
    window.requestAnimationFrame(tick);
  }

  document.addEventListener("visibilitychange", () => {
    lastTimestamp = null;
  });

  const resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(canvas);
  resizeCanvas();
  window.requestAnimationFrame(tick);
})();
