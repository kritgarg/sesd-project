# idea.md

## Project Overview
SwiftShare is a secure room-based peer-to-peer file transfer platform where users can create temporary rooms and transfer files directly using WebRTC. The backend acts only as a signaling server and session manager, ensuring that files never touch the backend server.

## Problem Statement
Traditional file-sharing services often require uploading files to a centralized server before the recipient can download them. This approach introduces latency, potential privacy risks, and relies heavily on the server's bandwidth and storage limits. Users need a fast, secure, and direct way to transfer files without intermediaries storing their data.

## Proposed Solution
SwiftShare solves this problem by utilizing WebRTC for direct, peer-to-peer file transfers between users. A centralized Node.js/Express backend handles only the signaling process (exchanging WebRTC connection details like offers, answers, and ICE candidates) and room management. Once the connection is established, the file is chunked and transferred directly between peers, with SHA-256 hash verification ensuring data integrity.

## System Architecture Explanation
The architecture follows a clean Layered Design (Controller → Service → Repository → Model) with SOLID Object-Oriented principles.
- **Frontend**: Built with React and WebRTC, responsible for the user interface, generating file chunks, and managing the WebRTC data channel.
- **Backend**: Built with Node.js and Express, connected to a PostgreSQL database via Prisma ORM. It manages user authentication, room generation, and stores transfer metadata.
- **Signaling Server**: WebSocket (ws) is used to exchange WebRTC signaling data in real-time between peers joined in the same room.
- **Database**: PostgreSQL structured with distinct tables for Users, Rooms, Sessions, and Transfers.

## Feature List

### MVP (Minimum Viable Product)
- Room creation with a unique, auto-generated room code
- Join room via unique code
- WebSocket-based signaling server (offer, answer, ICE exchange)
- Peer-to-peer file transfer via WebRTC Data Channels
- File chunking and progress tracking
- SHA-256 hash verification for file integrity

### Advanced Features
- Optional user authentication (JWT-based)
- Transfer history tracking (recording metadata only, no file content)
- Room expiration system (auto-closing rooms after a certain period or upon disconnect)
- Rate limiting to protect the backend and signaling server

### Bonus Features
- Admin panel for managing users
- Comprehensive logging middleware for backend monitoring

## Tech Stack
- **Backend:** Node.js, Express, WebSocket (ws)
- **Database:** PostgreSQL with Prisma ORM
- **Frontend:** React, WebRTC
- **Authentication:** JWT (JSON Web Tokens)
- **Architecture:** Layered (Controller → Service → Repository → Model)

## Backend Design Principles
- **OOP Principles:** Leveraging classes, encapsulation, and abstractions.
- **SOLID Design:** Ensuring maintainability, single responsibilities, and dependency inversion where applicable.
- **Separation of Concerns:** Clear boundaries between Controllers (HTTP/WS handling), Services (business logic), and Repositories (database operations).

## Scope Limitations
- Files are not stored on the server under any circumstances; if the recipient disconnects, the transfer fails.
- Both users must be online simultaneously in the same room to facilitate a transfer.
- Network topologies with restrictive NATs/Firewalls might require STUN/TURN servers.
