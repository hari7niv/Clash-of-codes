import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function useRoomData(roomCode: string | null) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!roomCode) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const [roomRes, playerRes] = await Promise.all([
          api.get(`/rooms/${roomCode}`),
          api.get("/users/me")
        ]);

        setData({
          room: roomRes.data,
          player: playerRes.data,
        });
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [roomCode]);

  const joinRoom = async (code: string) => {
    const res = await api.post(`/rooms/${code}/join`);
    return res.data;
  };

  const createRoom = async (config: any) => {
    const res = await api.post("/rooms", config);
    return res.data;
  };

  return { ...data, loading, error, joinRoom, createRoom };
}
