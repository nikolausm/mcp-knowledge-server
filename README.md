# MCP Knowledge Server

Ein Model Context Protocol (MCP) Server zur Verwaltung von Wissen und Informationen, die über Gespräche hinweg erhalten bleiben.

## Features

- **Wissen speichern**: Speichere Informationen mit Kategorien und Tags
- **Wissen abrufen**: Suche nach Stichwörtern, Kategorien oder Tags
- **Wissen aktualisieren**: Bearbeite bestehende Einträge
- **Wissen löschen**: Entferne nicht mehr benötigte Einträge
- **Kategorien anzeigen**: Überblick über alle verwendeten Kategorien

## Installation

Voraussetzung: Node.js 20 oder neuer.

1. Installiere die Abhängigkeiten:
```bash
cd ~/mcp-knowledge-server
npm install
```

2. Kompiliere TypeScript:
```bash
npm run build
```

## Claude Desktop Konfiguration

Füge folgendes zu deiner Claude Desktop Konfiguration hinzu:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "knowledge": {
      "command": "node",
      "args": ["/Users/michaelnikolaus/mcp-knowledge-server/dist/index.js"]
    }
  }
}
```

## Verwendung

Nach der Konfiguration kannst du in Claude folgende Tools verwenden:

- `store_knowledge`: Neues Wissen speichern
- `retrieve_knowledge`: Wissen suchen und abrufen
- `update_knowledge`: Bestehende Einträge aktualisieren
- `delete_knowledge`: Einträge löschen
- `list_categories`: Alle Kategorien anzeigen

## Datenstruktur

Die Wissensdatenbank wird in `knowledge/knowledge.json` gespeichert mit folgender Struktur:

```json
{
  "entries": [
    {
      "id": "1234567890",
      "category": "programming",
      "title": "Python Tipps",
      "content": "Hier sind nützliche Python Tipps...",
      "tags": ["python", "tipps", "programmierung"],
      "created": "2024-01-01T12:00:00Z",
      "updated": "2024-01-01T12:00:00Z"
    }
  ]
}
```

## Entwicklung

Für die Entwicklung kannst du den Server direkt mit TypeScript starten:

```bash
npm run dev
```
