# Project Intention

This project exists to explore practical privacy-by-design communication, focusing on minimizing trust, metadata exposure, and attack surface, not on novelty or cryptographic reinvention.

It is **not** intended to replace existing secure messengers, nor to compete with mature protocols. Instead, it is a learning-driven, threat-aware prototype that prioritizes architectural clarity over feature richness.

# What this project is

- A minimal 1:1 encrypted communication prototype

- Designed with ephemeral sessions

- No accounts, no identities, no history

- End-to-end encryption performed entirely on the client

- A server that acts strictly as a blind relay of opaque data

## The server is designed to not know:

- who the users are

- what is being transmitted

- how many real messages exist

- which packets are meaningful

- What this project is not

## This project does not aim to:

- Be production-ready

- Resist targeted nation-state attacks

- Protect compromised endpoints

- Guarantee anonymity against global adversaries

- Offer persistence, backups, or recoverability

**If a session is lost, the conversation is lost by design.**

# Threat model (explicit and limited)

## This project aims to defend against:

- Passive network observers

- Curious or compromised servers

- ISPs and local traffic inspection

- Opportunistic attackers

### It does not defend against:

- Malware on the client

- Keyloggers or browser compromise

- Focused nation-state surveillance

- Users leaking their own secrets

- Core design principles
-----------------------------------------------------
Minimal surface area
Fewer features → fewer vulnerabilities

Ephemeral by default
Sessions are temporary and disposable

Client authority
All cryptographic operations happen on the client

Server blindness
The server cannot infer meaning from traffic

Explicit trade-offs
Security decisions are documented and intentional

# Why this exists

This project exists as a learning artifact and a statement against overengineering.

## Many systems fail not because cryptography is broken, but because:

- metadata leaks

- unnecessary state is retained

- servers are trusted more than they should be

- complexity grows beyond understanding

This project intentionally chooses clarity over completeness.

Intended audience

Security students

Developers learning threat modeling

People interested in privacy-preserving architectures

Researchers who value explicit assumptions over vague promises

Final note:
This project makes no grand claims. If you are looking for absolute security, use battle-tested tools.
If you are looking to understand why secure systems work (or fail), this project exists for you ❤️
