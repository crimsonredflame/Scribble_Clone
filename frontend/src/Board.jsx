import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');
const ROOM_ID = 'design_room_1'; 

const Board = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth * 0.8;
    canvas.height = window.innerHeight * 0.8;
    
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'black';
    setContext(ctx);

    socket.emit('join_room', ROOM_ID);

    socket.on('load_history', (history) => {
      history.forEach((stroke) => drawLine(ctx, stroke.x0, stroke.y0, stroke.x1, stroke.y1, stroke.color, false));
    });

    socket.on('draw_event', (stroke) => {
      drawLine(ctx, stroke.x0, stroke.y0, stroke.x1, stroke.y1, stroke.color, false);
    });

    socket.on('clear_board', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => socket.off();
  }, []);

  const drawLine = (ctx, x0, y0, x1, y1, color, emit) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.closePath();

    if (!emit) return;

    const strokeData = { x0, y0, x1, y1, color, timestamp: Date.now() };
    socket.emit('draw_event', { roomId: ROOM_ID, strokeData });
  };

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    context.beginPath();
    context.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    
    drawLine(context, offsetX - 1, offsetY - 1, offsetX, offsetY, 'black', true);
  };

  const stopDrawing = () => {
    context.closePath();
    setIsDrawing(false);
  };

  const clearBoard = () => {
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socket.emit('clear_board', ROOM_ID);
  };

  return (
    <div>
      <button onClick={clearBoard}>Clear Board</button>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        style={{ border: '1px solid black', cursor: 'crosshair' }}
      />
    </div>
  );
};

export default Board;