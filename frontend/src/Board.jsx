import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';
const socket = io('https://scribble-clone-i1nh.onrender.com');
const ROOM_ID = 'design_room_1'; 

const Board = () => {
  const [username, setUsername] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [players, setPlayers] = useState([]);
  
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const chatEndRef = useRef(null);

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState(null);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(6);
  const [brushType, setBrushType] = useState('solid'); 

  useEffect(() => {
    socket.on('update_players', (playerList) => {
      setPlayers(playerList);
    });

    socket.on('receive_chat', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('load_history', (history) => {
      if (context) {
        history.forEach((stroke) => drawLine(context, stroke.x0, stroke.y0, stroke.x1, stroke.y1, stroke.color, stroke.brushSize, stroke.brushType, false));
      }
    });

    socket.on('draw_event', (stroke) => {
      if (context) {
        drawLine(context, stroke.x0, stroke.y0, stroke.x1, stroke.y1, stroke.color, stroke.brushSize, stroke.brushType, false);
      }
    });

    socket.on('clear_board', () => {
      if (canvasRef.current && context) {
        context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    });

    return () => {
      socket.off('update_players');
      socket.off('receive_chat');
      socket.off('load_history');
      socket.off('draw_event');
      socket.off('clear_board');
    };
  }, [context]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (hasJoined && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = window.innerWidth * 0.55; 
      canvas.height = window.innerHeight * 0.70; 
      setContext(canvas.getContext('2d'));
    }
  }, [hasJoined]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      // Optimistic UI update: instantly add the user locally just in case Redis is slow/offline
      setPlayers(prev => prev.includes(username) ? prev : [...prev, username]);
      socket.emit('join_game', { roomId: ROOM_ID, username });
      setHasJoined(true);
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      const msgData = { sender: username, text: chatMessage, type: 'user' };
      setMessages((prev) => [...prev, msgData]);
      socket.emit('send_chat', { roomId: ROOM_ID, username, text: chatMessage });
      setChatMessage('');
    }
  };

  const drawLine = (ctx, x0, y0, x1, y1, strokeColor, strokeWidth, type, emit) => {
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    if (type === 'dashed') {
      ctx.setLineDash([strokeWidth * 2, strokeWidth * 1.5]);
    } else if (type === 'highlighter') {
      ctx.globalAlpha = 0.3;
      ctx.globalCompositeOperation = 'multiply';
      ctx.lineWidth = strokeWidth * 2; 
    }

    if (type === 'spray') {
      const density = strokeWidth * 2;
      for (let i = 0; i < density; i++) {
        const offsetX = (Math.random() - 0.5) * strokeWidth * 2.5;
        const offsetY = (Math.random() - 0.5) * strokeWidth * 2.5;
        ctx.fillRect(x1 + offsetX, y1 + offsetY, 1, 1);
      }
    } else {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    
    ctx.closePath();

    if (!emit) return;
    const strokeData = { x0, y0, x1, y1, color: strokeColor, brushSize: strokeWidth, brushType: type, timestamp: Date.now() };
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
    drawLine(context, offsetX - 1, offsetY - 1, offsetX, offsetY, color, brushSize, brushType, true);
  };

  const stopDrawing = () => setIsDrawing(false);
  
  const clearBoard = () => {
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socket.emit('clear_board', ROOM_ID);
  };

  if (!hasJoined) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap');
          body {
            margin: 0;
            background-color: #3b82f6;
            background-image: radial-gradient(#60a5fa 15%, transparent 15%), radial-gradient(#60a5fa 15%, transparent 15%);
            background-size: 40px 40px;
            background-position: 0 0, 20px 20px;
            font-family: 'Fredoka', sans-serif;
          }
          .join-container {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            flex-direction: column;
          }
          .title-text {
            font-size: 5rem;
            color: #ffde34;
            text-shadow: 4px 4px 0px #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000;
            margin-bottom: 20px;
            letter-spacing: 2px;
            transform: rotate(-3deg);
          }
          .join-box {
            background: white;
            padding: 40px;
            border-radius: 16px;
            border: 4px solid #1e293b;
            box-shadow: 8px 8px 0px rgba(30, 41, 59, 1);
            text-align: center;
            width: 350px;
          }
          .join-input {
            box-sizing: border-box; /* This fixes the distortion! */
            width: 100%;
            padding: 15px;
            font-size: 20px;
            border-radius: 8px;
            border: 3px solid #cbd5e1;
            margin-bottom: 20px;
            font-family: 'Fredoka', sans-serif;
            outline: none;
            transition: all 0.2s;
          }
          .join-input:focus {
            border-color: #3b82f6;
          }
          .join-btn {
            width: 100%;
            padding: 15px;
            background: #22c55e;
            color: white;
            border: 3px solid #14532d;
            border-radius: 8px;
            font-size: 24px;
            font-weight: 700;
            font-family: 'Fredoka', sans-serif;
            cursor: pointer;
            box-shadow: 0 6px 0px #14532d;
            transition: all 0.1s;
          }
          .join-btn:active {
            transform: translateY(6px);
            box-shadow: 0 0px 0px #14532d;
          }
        `}</style>
        <div className="join-container">
          <h1 className="title-text">Scribble.io</h1>
          <form onSubmit={handleJoin} className="join-box">
            <h2 style={{ margin: '0 0 20px 0', color: '#1e293b' }}>Play Now!</h2>
            <input 
              type="text" 
              placeholder="Enter your name" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              className="join-input"
              maxLength={15}
              required
            />
            <button type="submit" className="join-btn">
              Play!
            </button>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap');
        body {
          margin: 0;
          background-color: #3b82f6;
          background-image: radial-gradient(#60a5fa 15%, transparent 15%), radial-gradient(#60a5fa 15%, transparent 15%);
          background-size: 40px 40px;
          background-position: 0 0, 20px 20px;
          font-family: 'Fredoka', sans-serif;
          height: 100vh;
          overflow: hidden;
        }
        .game-wrapper {
          display: flex;
          flex-direction: column;
          height: 100vh;
          padding: 15px;
          box-sizing: border-box;
          gap: 15px;
        }
        .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          padding: 10px 30px;
          border-radius: 12px;
          border: 3px solid #1e293b;
          box-shadow: 4px 4px 0px #1e293b;
        }
        .logo-small {
          font-size: 2rem;
          color: #ffde34;
          margin: 0;
          text-shadow: 2px 2px 0px #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
        }
        .toolbar {
          display: flex;
          gap: 15px;
          align-items: center;
        }
        .game-panel {
          background: white;
          border-radius: 12px;
          border: 3px solid #1e293b;
          box-shadow: 4px 4px 0px #1e293b;
          overflow: hidden;
        }
        .tool-select, .tool-slider {
          padding: 8px;
          border: 2px solid #cbd5e1;
          border-radius: 8px;
          font-family: 'Fredoka', sans-serif;
          font-size: 16px;
        }
        .clear-btn {
          background: #ef4444;
          color: white;
          border: 2px solid #7f1d1d;
          padding: 8px 16px;
          border-radius: 8px;
          font-family: 'Fredoka', sans-serif;
          font-size: 16px;
          cursor: pointer;
          box-shadow: 0 4px 0px #7f1d1d;
        }
        .clear-btn:active {
          transform: translateY(4px);
          box-shadow: 0 0px 0px #7f1d1d;
        }
        /* Layout fixes to keep chat at the bottom */
        .workspace {
          display: flex;
          flex: 1;
          gap: 15px;
          min-height: 0; /* Important for flex children to not overflow */
        }
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 15px;
          background: #f8fafc;
        }
        .chat-input-area {
          display: flex;
          padding: 10px;
          background: #e2e8f0;
          border-top: 3px solid #1e293b;
        }
        .chat-input {
          flex: 1;
          padding: 10px;
          border-radius: 6px;
          border: 2px solid #94a3b8;
          font-family: 'Fredoka', sans-serif;
          outline: none;
        }
        .chat-send {
          background: #3b82f6;
          color: white;
          border: 2px solid #1e3a8a;
          border-radius: 6px;
          padding: 0 15px;
          margin-left: 10px;
          font-family: 'Fredoka', sans-serif;
          font-weight: bold;
          cursor: pointer;
        }
      `}</style>

      <div className="game-wrapper">
        
        <div className="top-bar">
          <h2 className="logo-small">Scribble.io</h2>
          <div className="toolbar">
            <select className="tool-select" value={brushType} onChange={(e) => setBrushType(e.target.value)}>
              <option value="solid">✏️ Pen</option>
              <option value="dashed">➖ Dashed</option>
              <option value="highlighter">🖍️ Highlighter</option>
              <option value="spray">💨 Spray</option>
            </select>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: '40px', height: '40px', cursor: 'pointer', border: 'none', background: 'none' }} />
            <input type="range" className="tool-slider" min="1" max="40" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} />
            <button className="clear-btn" onClick={clearBoard}>Trash 🗑️</button>
          </div>
        </div>

        <div className="workspace">
          
          <div className="game-panel" style={{ width: '220px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#1e293b', color: 'white', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Players</div>
            <ul style={{ listStyle: 'none', padding: '10px', margin: 0, overflowY: 'auto', flex: 1 }}>
              {players.map((p, i) => (
                <li key={i} style={{ padding: '8px', borderBottom: '2px solid #e2e8f0', color: p === username ? '#3b82f6' : '#334155', fontWeight: 'bold' }}>
                  {i + 1}. {p} {p === username && '(You)'}
                </li>
              ))}
            </ul>
          </div>

          <div className="game-panel" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'white' }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              style={{ cursor: 'crosshair' }}
            />
          </div>

          <div className="game-panel chat-container" style={{ width: '300px' }}>
            <div style={{ background: '#1e293b', color: 'white', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Chat</div>
            <div className="chat-messages">
              {messages.map((msg, i) => (
                <div key={i} style={{ marginBottom: '8px', fontSize: '14px', lineHeight: '1.4' }}>
                  {msg.type === 'system' ? (
                    <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{msg.text}</span>
                  ) : (
                    <span><strong style={{ color: msg.sender === username ? '#3b82f6' : '#334155' }}>{msg.sender}:</strong> {msg.text}</span>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form className="chat-input-area" onSubmit={handleSendChat}>
              <input 
                type="text" 
                className="chat-input"
                value={chatMessage} 
                onChange={(e) => setChatMessage(e.target.value)} 
                placeholder="Guess here..."
              />
              <button type="submit" className="chat-send">Send</button>
            </form>
          </div>

        </div>
      </div>
    </>
  );
};

export default Board;
