/**
 * The room, as React sees it.
 *
 * Everything that actually talks to the server lives in room.js, which has no
 * React in it and is tested without a browser. This file is the part that
 * cannot be: a hook that opens the stream when the session changes, closes it
 * when the component goes away, and keeps what arrived in state.
 *
 * The re-exports below are so that the screens can keep importing from here;
 * what they want is the room, not the file it happens to live in.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { note } from '../../features/errors/index.js';
import { connect, sendAction } from './room.js';

export {
  ApiError,
  clearSession,
  createRoom,
  joinRoom,
  leaveRoom,
  loadSession,
  serverInfo,
  serverIsRunning,
} from './room.js';

export function useRoom(session) {
  const [payload, setPayload] = useState(null);
  const [connection, setConnection] = useState('connecting'); // connecting | live | lost
  const [error, setError] = useState(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const roomRef = useRef(null);

  useEffect(() => {
    if (!session) return undefined;

    const room = connect(session, {
      onPayload: setPayload,
      onStatus: setConnection,
    });
    roomRef.current = room;

    return () => {
      room.close();
      roomRef.current = null;
    };
  }, [session?.code, session?.token, connectionAttempt]);

  const act = useCallback(
    async (action) => {
      if (!session) return;
      setError(null);
      // The name of what was asked for, never what was in it: a trail of
      // these is enough to see how a screen reached the state it broke in,
      // and there is nothing in it that could give a word away.
      note(action.type);
      try {
        await sendAction(session, action);
      } catch (err) {
        setError(err);
      }
    },
    [session],
  );

  return {
    payload,
    connection,
    error,
    clearError: () => setError(null),
    reconnect: () => setConnectionAttempt((attempt) => attempt + 1),
    act,
  };
}
