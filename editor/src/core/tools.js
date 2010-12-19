////////////////////////////////////////////////////////////////////////////////
// class CameraPanTool
////////////////////////////////////////////////////////////////////////////////

function CameraPanTool(worldCenter) {
	this.worldCenter = worldCenter;
	this.oldPoint = new Vector(0, 0);
}

CameraPanTool.prototype.mouseDown = function(point) {
	this.oldPoint = point;
};

CameraPanTool.prototype.mouseMoved = function(point) {
	// Cannot set this.worldCenter directly because that wouldn't modify the original object
	this.worldCenter.x -= point.x - this.oldPoint.x;
	this.worldCenter.y -= point.y - this.oldPoint.y;
};

CameraPanTool.prototype.mouseUp = function(point) {
};

CameraPanTool.prototype.draw = function(c) {
};

////////////////////////////////////////////////////////////////////////////////
// class SetCellTool
////////////////////////////////////////////////////////////////////////////////

var SETCELL_EMPTY = 0;
var SETCELL_SOLID = 1;
var SETCELL_DIAGONAL = 2;

function SetCellTool(doc, mode) {
	this.doc = doc;
	this.mode = mode;
	this.dragging = false;
}

SetCellTool.prototype.mouseDown = function(point) {
	this.doc.undoStack.beginMacro();
	this.dragging = true;
	this.mouseMoved(point);
};

SetCellTool.prototype.mouseMoved = function(point) {
	var cellX = Math.floor(point.x);
	var cellY = Math.floor(point.y);
	var cellType;

	if (this.mode == SETCELL_DIAGONAL) {
		// Pick a different cell type depending on the quadrant
		if (point.x - cellX < 0.5) {
			cellType = (point.y - cellY < 0.5) ? CELL_FLOOR_DIAG_LEFT : CELL_CEIL_DIAG_LEFT;
		} else {
			cellType = (point.y - cellY < 0.5) ? CELL_FLOOR_DIAG_RIGHT : CELL_CEIL_DIAG_RIGHT;
		}
	} else {
		cellType = (this.mode == SETCELL_EMPTY) ? CELL_EMPTY : CELL_SOLID;
	}
	
	// Only change the cell type if it's different
	if (this.dragging && this.doc.world.getCell(cellX, cellY) != cellType) {
		this.doc.setCell(cellX, cellY, cellType);
	}
};

SetCellTool.prototype.mouseUp = function(point) {
	this.doc.undoStack.endMacro();
	this.dragging = false;
};

SetCellTool.prototype.draw = function(c) {
};

////////////////////////////////////////////////////////////////////////////////
// class PlaceDoorTool
////////////////////////////////////////////////////////////////////////////////

function PlaceDoorTool(doc, isOneWay) {
	this.doc = doc;
	this.isOneWay = isOneWay;
	this.edge = null;
}

PlaceDoorTool.prototype.mouseDown = function(point) {
	this.mouseMoved(point);
	this.doc.addPlaceable(new Door(this.isOneWay, this.edge));
};

PlaceDoorTool.prototype.mouseMoved = function(point) {
	// Generate all the edges in the cell under point
	var x = Math.floor(point.x);
	var y = Math.floor(point.y);
	var p00 = new Vector(x, y);
	var p10 = new Vector(x + 1, y);
	var p01 = new Vector(x, y + 1);
	var p11 = new Vector(x + 1, y + 1);
	var edges = [
		new Edge(p00, p10),
		new Edge(p01, p00),
		new Edge(p00, p11),
		new Edge(p10, p01),
		new Edge(p10, p11),
		new Edge(p11, p01)
	];
	
	// Pick the closest edge facing away from point
	this.edge = EdgePicker.getClosestEdge(point, edges);
	if (!this.edge.pointBehindEdge(point)) this.edge.flip();
};

PlaceDoorTool.prototype.mouseUp = function(point) {
};

PlaceDoorTool.prototype.draw = function(c) {
	if (this.edge != null) {
		c.strokeStyle = rgba(0, 0, 0, 0.5);
		this.edge.draw(c);
		
		if (!this.isOneWay) {
			this.edge.flip();
			this.edge.draw(c);
			this.edge.flip();
		}
	}
};

////////////////////////////////////////////////////////////////////////////////
// class SelectionTool
////////////////////////////////////////////////////////////////////////////////

var SELECTION_MODE_NONE = 0;
var SELECTION_MODE_SELECT = 1;
var SELECTION_MODE_MOVE = 2;

function SelectionTool(doc) {
	this.doc = doc;
	this.mode = SELECTION_MODE_NONE;
	this.start = this.end = null;
}

SelectionTool.prototype.mouseDown = function(point) {
	// Check if we clicked on an existing selection
	var clickedOnSelection = false;
	var padding = new Vector(0.2, 0.2);
	var selection = this.doc.world.getSelection();
	var selectionUnderMouse = this.doc.world.selectionInRect(new Rectangle(point.sub(padding), point.add(padding)));
	for (var i = 0; i < selectionUnderMouse.length; i++) {
		for (var j = 0; j < selection.length; j++) {
			if (selectionUnderMouse[i] == selection[j]) {
				clickedOnSelection = true;
				break;
			}
		}
	}
	
	// If we clicked on an existing selection, move it around instead
	this.doc.undoStack.beginMacro();
	if (clickedOnSelection) {
		this.mode = SELECTION_MODE_MOVE;
		this.start = point;
	} else {
		this.mode = SELECTION_MODE_SELECT;
		this.start = this.end = point;
		this.mouseMoved(point);
	}
};

SelectionTool.prototype.mouseMoved = function(point) {
	this.end = point;
	if (this.mode == SELECTION_MODE_SELECT) {
		this.doc.setSelection(this.doc.world.selectionInRect(new Rectangle(this.start, this.end)));
	} else if (this.mode == SELECTION_MODE_MOVE) {
		this.doc.moveSelection(point.sub(this.start));
		this.start = point;
	}
};

SelectionTool.prototype.mouseUp = function(point) {
	if (this.mode == SELECTION_MODE_MOVE) {
		// Reset all anchors, needed for placeables that lock to the grid (walls/doors)
		var selection = this.doc.world.getSelection();
		for (var i = 0; i < selection.length; i++) {
			selection[i].resetAnchor();
		}
	}
	this.mode = SELECTION_MODE_NONE;
	this.doc.undoStack.endMacro();
};

SelectionTool.prototype.draw = function(c) {
	if (this.mode == SELECTION_MODE_SELECT) {
		c.fillStyle = rgba(0, 0, 0, 0.1);
		c.strokeStyle = rgba(0, 0, 0, 0.5);
		c.fillRect(this.start.x, this.start.y, this.end.x - this.start.x, this.end.y - this.start.y);
		c.strokeRect(this.start.x, this.start.y, this.end.x - this.start.x, this.end.y - this.start.y);
	}
};

////////////////////////////////////////////////////////////////////////////////
// class SetPlayerStartTool
////////////////////////////////////////////////////////////////////////////////

function SetPlayerStartTool(doc) {
	this.doc = doc;
	this.point = null;
	this.dragging = false;
}

SetPlayerStartTool.prototype.mouseDown = function(point) {
	this.dragging = true;
	this.doc.undoStack.beginMacro();
	this.mouseMoved(point);
};

SetPlayerStartTool.prototype.mouseMoved = function(point) {
	if (this.dragging) {
		this.doc.setPlayerStart(new Vector(Math.floor(point.x), Math.floor(point.y)));
	}
	this.point = point;
};

SetPlayerStartTool.prototype.mouseUp = function(point) {
	this.dragging = false;
	this.doc.undoStack.endMacro();
};

SetPlayerStartTool.prototype.draw = function(c) {
	if (this.point != null) {
		Sprites.drawSpawnPoint(c, 0.5, this.point.floor().add(new Vector(0.5, 0.5)));
	}
};

////////////////////////////////////////////////////////////////////////////////
// class SetPlayerGoalTool
////////////////////////////////////////////////////////////////////////////////

function SetPlayerGoalTool(doc) {
	this.doc = doc;
	this.point = null;
	this.dragging = false;
}

SetPlayerGoalTool.prototype.mouseDown = function(point) {
	this.dragging = true;
	this.doc.undoStack.beginMacro();
	this.mouseMoved(point);
};

SetPlayerGoalTool.prototype.mouseMoved = function(point) {
	if (this.dragging) {
		this.doc.setPlayerGoal(new Vector(Math.floor(point.x), Math.floor(point.y)));
	}
	this.point = point;
};

SetPlayerGoalTool.prototype.mouseUp = function(point) {
	this.dragging = false;
	this.doc.undoStack.endMacro();
};

SetPlayerGoalTool.prototype.draw = function(c) {
	if (this.point != null) {
		Sprites.drawGoal(c, 0.5, this.point.floor().add(new Vector(0.5, 0.5)), 0.6);
	}
};

////////////////////////////////////////////////////////////////////////////////
// class AddPlaceableTool
////////////////////////////////////////////////////////////////////////////////

function AddPlaceableTool(doc, factoryFunc) {
	this.doc = doc;
	this.factoryFunc = factoryFunc;
	this.point = null;
}

AddPlaceableTool.prototype.mouseDown = function(point) {
	this.mouseMoved(point);
	this.doc.addPlaceable(this.factoryFunc(this.point));
};

AddPlaceableTool.prototype.mouseMoved = function(point) {
	this.point = point;
};

AddPlaceableTool.prototype.mouseUp = function(point) {
};

AddPlaceableTool.prototype.draw = function(c) {
	if (this.point != null) {
		this.factoryFunc(this.point).draw(c, 0.5);
		// Sprites.drawCog(c, 0.5, this.point.x, this.point.y, COG_RADIUS);
	}
};