import { config } from "dotenv";
config();

const key = JSON.parse(process.env.BITTE_KEY || "{}");
const bitteConfig = JSON.parse(process.env.BITTE_CONFIG || "{}");
if (!key?.accountId) {
  console.error("no account");
}

const url = bitteConfig.url || "https://near-uniswap-agent.vercel.app";

export const pluginData = {
  openapi: "3.0.0",
  info: {
    title: "DexScreener Plugin",
    description: "API for interacting with DexScreener data",
    version: "1.0.0",
  },
  servers: [{ url }],
  "x-mb": {
    "account-id": key.accountId,
    "email": process.env.CONTACT_EMAIL || "contact@example.com",
    "assistant": {
      "name": "DexScreener Assistant",
      "description": "An assistant that provides token price and market data from DexScreener",
      "instructions": "Provides token price information, latest token listings, and monitors tokens for price dips.",
      "tools": [{ type: "submit-query" }],
      "image": `${url}/dexscreener.svg`,
      "categories": ["DeFi", "Market Data", "Price Tracking"],
      "version": "1.0.0"
    }
  },
  paths: {
    "/api/tools/dexscreener/token-price": {
      get: {
        tags: ["dexscreener"],
        summary: "Get token price",
        description: "Fetches current price and market data for a specified token",
        operationId: "get-token-price",
        parameters: [
          {
            name: "token",
            in: "query",
            description: "Token address or symbol. Can include chainId:tokenAddress format for specific chains",
            required: true,
            schema: {
              type: "string"
            },
            example: "ETH"
          }
        ],
        responses: {
          "200": {
            description: "Token price information",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    result: {
                      type: "string",
                      description: "Formatted token price data"
                    }
                  }
                }
              }
            }
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Missing required parameter: token"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tools/dexscreener/latest-tokens": {
      get: {
        tags: ["dexscreener"],
        summary: "Get latest tokens",
        description: "Fetches the most recently listed tokens on DexScreener",
        operationId: "get-latest-tokens",
        responses: {
          "200": {
            description: "Latest tokens information",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    result: {
                      type: "string",
                      description: "Formatted list of latest tokens"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tools/dexscreener/latest-boosted-tokens": {
      get: {
        tags: ["dexscreener"],
        summary: "Get latest boosted tokens",
        description: "Fetches the most recently boosted tokens on DexScreener",
        operationId: "get-latest-boosted-tokens",
        responses: {
          "200": {
            description: "Latest boosted tokens information",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    result: {
                      type: "string",
                      description: "Formatted list of latest boosted tokens"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tools/dexscreener/top-boosted-tokens": {
      get: {
        tags: ["dexscreener"],
        summary: "Get top boosted tokens",
        description: "Fetches the tokens with the most active boosts on DexScreener",
        operationId: "get-top-boosted-tokens",
        responses: {
          "200": {
            description: "Top boosted tokens information",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    result: {
                      type: "string",
                      description: "Formatted list of top boosted tokens"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tools/dexscreener/token-orders/{chainId}/{tokenAddress}": {
      get: {
        tags: ["dexscreener"],
        summary: "Check token orders",
        description: "Checks if a token has any paid orders",
        operationId: "check-token-orders",
        parameters: [
          {
            name: "chainId",
            in: "path",
            description: "Blockchain chain ID",
            required: true,
            schema: {
              type: "string"
            },
            example: "ethereum"
          },
          {
            name: "tokenAddress",
            in: "path",
            description: "Token contract address",
            required: true,
            schema: {
              type: "string"
            },
            example: "0x1234567890abcdef1234567890abcdef12345678"
          }
        ],
        responses: {
          "200": {
            description: "Token orders information",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    result: {
                      type: "string",
                      description: "Formatted list of token orders"
                    }
                  }
                }
              }
            }
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Missing required parameters: chainId and tokenAddress"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tools/dexscreener/pair/{chainId}/{pairId}": {
      get: {
        tags: ["dexscreener"],
        summary: "Get pair information",
        description: "Fetches information about a specific pair by chain and pair address",
        operationId: "get-pair-information",
        parameters: [
          {
            name: "chainId",
            in: "path",
            description: "Blockchain chain ID",
            required: true,
            schema: {
              type: "string"
            },
            example: "ethereum"
          },
          {
            name: "pairId",
            in: "path",
            description: "Pair address",
            required: true,
            schema: {
              type: "string"
            },
            example: "0x1234567890abcdef1234567890abcdef12345678"
          }
        ],
        responses: {
          "200": {
            description: "Pair information",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    result: {
                      type: "string",
                      description: "Formatted pair information"
                    }
                  }
                }
              }
            }
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Missing required parameters: chainId and pairId"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tools/dexscreener/token-pools/{chainId}/{tokenAddress}": {
      get: {
        tags: ["dexscreener"],
        summary: "Get token pools",
        description: "Fetches pools information for a specific token",
        operationId: "get-token-pools",
        parameters: [
          {
            name: "chainId",
            in: "path",
            description: "Blockchain chain ID",
            required: true,
            schema: {
              type: "string"
            },
            example: "ethereum"
          },
          {
            name: "tokenAddress",
            in: "path",
            description: "Token contract address",
            required: true,
            schema: {
              type: "string"
            },
            example: "0x1234567890abcdef1234567890abcdef12345678"
          }
        ],
        responses: {
          "200": {
            description: "Token pools information",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    result: {
                      type: "string",
                      description: "Formatted token pools information"
                    }
                  }
                }
              }
            }
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Missing required parameters: chainId and tokenAddress"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}; 