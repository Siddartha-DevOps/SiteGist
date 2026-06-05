import type { Party, PartyServer, PartyConnection, PartyRequest } from "partykit/server";

export default class ChatServer implements PartyServer {
  constructor(readonly party: Party) {}

  onConnect(connection: PartyConnection) {
    // Welcome the new connection
    console.log(`Connected: ${connection.id}`);
  }

  onMessage(message: string, sender: PartyConnection) {
    // Broadcast the message to all connections including the sender
    this.party.broadcast(message);
  }

  onClose(connection: PartyConnection) {
    console.log(`Closed: ${connection.id}`);
  }

  async onRequest(request: PartyRequest) {
    if (request.method === "POST" || request.method === "OPTIONS") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }
      try {
        const body = await request.json();
        this.party.broadcast(JSON.stringify(body));
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }
    // Basic health check or metadata endpoint
    return new Response("PartyKit Chat Server is running!", {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
