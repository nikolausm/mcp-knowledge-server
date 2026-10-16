import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  type CallToolRequest,
  type CallToolResult,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pfad zur Wissensdatenbank
const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');
const KNOWLEDGE_FILE = path.join(KNOWLEDGE_DIR, 'knowledge.json');

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  created: string;
  updated: string;
}

interface KnowledgeBase {
  entries: KnowledgeEntry[];
}

class KnowledgeServer {
  private server: Server;
  
  constructor() {
    this.server = new Server(
      {
        name: 'knowledge-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupHandlers();
    
    // Sicherstellen, dass das Knowledge-Verzeichnis existiert
    this.initializeKnowledgeBase();
  }
  
  private async initializeKnowledgeBase() {
    try {
      await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
      
      // Prüfen ob knowledge.json existiert
      try {
        await fs.access(KNOWLEDGE_FILE);
      } catch {
        // Datei existiert nicht, erstelle eine leere
        const emptyKb: KnowledgeBase = { entries: [] };
        await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(emptyKb, null, 2));
      }
    } catch (error) {
      console.error('Fehler beim Initialisieren der Wissensdatenbank:', error);
    }
  }
  
  private async loadKnowledgeBase(): Promise<KnowledgeBase> {
    try {
      const data = await fs.readFile(KNOWLEDGE_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return { entries: [] };
    }
  }
  
  private async saveKnowledgeBase(kb: KnowledgeBase): Promise<void> {
    await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(kb, null, 2));
  }
  
  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'store_knowledge',
          description: 'Speichert neues Wissen in der Datenbank',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: 'Kategorie des Wissens (z.B. "programming", "personal", "project")',
              },
              title: {
                type: 'string',
                description: 'Titel des Eintrags',
              },
              content: {
                type: 'string',
                description: 'Der Inhalt des Wissens',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags zur besseren Suche',
              },
            },
            required: ['category', 'title', 'content'],
          },
        },
        {
          name: 'retrieve_knowledge',
          description: 'Ruft Wissen aus der Datenbank ab',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Suchbegriff (durchsucht Titel, Inhalt und Tags)',
              },
              category: {
                type: 'string',
                description: 'Optional: Filtere nach Kategorie',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional: Filtere nach Tags',
              },
            },
          },
        },
        {
          name: 'update_knowledge',
          description: 'Aktualisiert einen bestehenden Wissensbeitrag',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'ID des zu aktualisierenden Eintrags',
              },
              category: {
                type: 'string',
                description: 'Neue Kategorie',
              },
              title: {
                type: 'string',
                description: 'Neuer Titel',
              },
              content: {
                type: 'string',
                description: 'Neuer Inhalt',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Neue Tags',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'delete_knowledge',
          description: 'Löscht einen Wissensbeitrag',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'ID des zu löschenden Eintrags',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'list_categories',
          description: 'Listet alle verfügbaren Kategorien auf',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));
    
    this.server.setRequestHandler<typeof CallToolRequestSchema>(
      CallToolRequestSchema,
      async (request: CallToolRequest): Promise<CallToolResult> => {
        switch (request.params.name) {
          case 'store_knowledge':
            return this.storeKnowledge(request.params.arguments);
          
          case 'retrieve_knowledge':
            return this.retrieveKnowledge(request.params.arguments);
          
          case 'update_knowledge':
            return this.updateKnowledge(request.params.arguments);
          
          case 'delete_knowledge':
            return this.deleteKnowledge(request.params.arguments);
          
          case 'list_categories':
            return this.listCategories();
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unbekanntes Tool: ${request.params.name}`
            );
        }
      }
    );
  }
  
  private async storeKnowledge(args: any): Promise<CallToolResult> {
    const kb = await this.loadKnowledgeBase();
    
    const newEntry: KnowledgeEntry = {
      id: Date.now().toString(),
      category: args.category,
      title: args.title,
      content: args.content,
      tags: args.tags || [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    
    kb.entries.push(newEntry);
    await this.saveKnowledgeBase(kb);
    
    return {
      content: [
        {
          type: 'text',
          text: `Wissen gespeichert mit ID: ${newEntry.id}`,
        },
      ],
    };
  }
  
  private async retrieveKnowledge(args: any): Promise<CallToolResult> {
    const kb = await this.loadKnowledgeBase();
    let results = kb.entries;
    
    // Filtern nach Kategorie
    if (args.category) {
      results = results.filter(e => e.category === args.category);
    }
    
    // Filtern nach Tags
    if (args.tags && args.tags.length > 0) {
      results = results.filter(e => 
        args.tags.some((tag: string) => e.tags.includes(tag))
      );
    }
    
    // Suche in Titel und Inhalt
    if (args.query) {
      const query = args.query.toLowerCase();
      results = results.filter(e => 
        e.title.toLowerCase().includes(query) ||
        e.content.toLowerCase().includes(query) ||
        e.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }
  
  private async updateKnowledge(args: any): Promise<CallToolResult> {
    const kb = await this.loadKnowledgeBase();
    const index = kb.entries.findIndex(e => e.id === args.id);
    
    if (index === -1) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Eintrag mit ID ${args.id} nicht gefunden`
      );
    }
    
    const entry = kb.entries[index];
    
    if (args.category !== undefined) entry.category = args.category;
    if (args.title !== undefined) entry.title = args.title;
    if (args.content !== undefined) entry.content = args.content;
    if (args.tags !== undefined) entry.tags = args.tags;
    
    entry.updated = new Date().toISOString();
    
    await this.saveKnowledgeBase(kb);
    
    return {
      content: [
        {
          type: 'text',
          text: `Eintrag ${args.id} aktualisiert`,
        },
      ],
    };
  }
  
  private async deleteKnowledge(args: any): Promise<CallToolResult> {
    const kb = await this.loadKnowledgeBase();
    const index = kb.entries.findIndex(e => e.id === args.id);
    
    if (index === -1) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Eintrag mit ID ${args.id} nicht gefunden`
      );
    }
    
    kb.entries.splice(index, 1);
    await this.saveKnowledgeBase(kb);
    
    return {
      content: [
        {
          type: 'text',
          text: `Eintrag ${args.id} gelöscht`,
        },
      ],
    };
  }
  
  private async listCategories(): Promise<CallToolResult> {
    const kb = await this.loadKnowledgeBase();
    const categories = [...new Set(kb.entries.map(e => e.category))];
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(categories, null, 2),
        },
      ],
    };
  }
  
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Knowledge Server läuft...');
  }
}

const server = new KnowledgeServer();
server.run().catch(console.error);
