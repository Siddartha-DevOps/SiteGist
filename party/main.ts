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

  onRequest(request: PartyRequest) {
    // Basic health check or metadata endpoint
    return new Response("PartyKit Chat Server is running!");
  }
}
