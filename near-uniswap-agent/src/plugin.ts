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
    title: "Bitte Uniswap Agent",
    description: "API for interactions with Uniswap V3",
    version: "1.0.0",
  },
  servers: [{ url }],
  "x-mb": {
    "account-id": key.accountId,
    "email": process.env.CONTACT_EMAIL || "contact@example.com",
    "assistant": {
      "name": "Uniswap Assistant",
      "description":
        "An assistant that helps you swap tokens, check prices, and monitor dips on Uniswap across EVM networks, with seamless NEAR wallet integration",
      "instructions":
        "Encodes transactions as signature requests on EVM networks. This assistant is only for EVM networks. Passes the the transaction fields of the response to generate-evm-tx tool for signing and displays the meta content of the response to the user after signing. For selling native assets, such as ETH, xDAI, POL, BNB it uses 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE as the sellToken. It does not infer the chainId. Do not infer the token decimals. Use Token Units for sellAmountBeforeFee. Uses token symbols for sellToken and buyToken unless addresses are provided. Always passes evmAddress as the safeAddress on any request requiring safeAddress. NEAR WALLET INTEGRATION: If a user mentions their NEAR wallet (e.g., 'yoshitoke.near'), use the NEAR wallet integration. For direct token swaps, use the /api/tools/near-wallet/near-swap endpoint with just the tokenAddress parameter. The backend will automatically use their NEAR account, the Base chain (8453), and 1 USDC as the sell amount. For the /buy-dip endpoint, set walletAddress=0x0 to automatically use their NEAR account. For the /balances endpoint, use 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE as the safeAddress. The backend will automatically generate a Safe address for the NEAR account. When a user asks to swap tokens using their NEAR wallet, always use the /api/tools/near-wallet/near-swap endpoint directly. BUY-DIP FEATURE: When a user wants to buy the dip for a token, use a two-step process: 1) First call /api/tools/dexscreener-uniswap/buy-dip to get token data and check if there's a significant dip (66.66% or more), 2) Show this data to the user, and 3) If the user wants to proceed with the swap, call /api/tools/dexscreener-uniswap/execute-swap to actually execute the transaction.",
      "tools": [{ type: "generate-evm-tx" }],
      "image": `${url}/uniswap.svg`,
      "categories": ["DeFi", "Uniswap", "Trading", "NEAR Wallet", "Swaps"],
      "chainIds": [1, 8453, 42161, 10, 137, 56],
      "version": "1.1.0"
    }
  },
  paths: {
    "/api/health": {
      get: {
        tags: ["health"],
        summary: "Confirms server running",
        description: "Test Endpoint to confirm system is running",
        operationId: "check-health",
        parameters: [],
        responses: {
          "200": {
            description: "Ok Message",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      description: "Ok Message",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/tools/balances": {
      get: {
        tags: ["balances"],
        summary: "Get Token Balances",
        description: "Returns token balances for the connected wallet. If USE_NEAR_WALLET=true is set in the environment, the balances will be fetched for the Safe address associated with your NEAR account. You can use 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE as a placeholder for safeAddress when using NEAR wallet integration.",
        operationId: "get-balances",
        parameters: [
          { $ref: "#/components/parameters/chainId" },
          { $ref: "#/components/parameters/safeAddress" },
        ],
        responses: {
          "200": {
            description: "List of token balances",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      token: {
                        $ref: "#/components/schemas/Address",
                      },
                      balance: {
                        type: "string",
                        description: "Token balance in smallest units (wei)",
                        example: "1000000000000000000",
                      },
                      symbol: {
                        type: "string",
                        description: "Token symbol",
                        example: "USDC",
                      },
                      decimals: {
                        type: "number",
                        description: "Token decimals",
                        example: 18,
                      },
                      logoUri: {
                        type: "string",
                        description: "Token logo URI",
                        example: "https://example.com/token-logo.png",
                      },
                    },
                    required: ["token", "balance", "symbol", "decimals"],
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest400" },
        },
      },
    },
    "/api/tools/uniswap": {
      post: {
        tags: ["uniswap"],
        operationId: "swap",
        summary:
          "Quote a price and fee for the specified order parameters. Posts unsigned order to Uniswap and returns Signable payload",
        description:
          "Given a partial order compute the minimum fee and a price estimate for the order. Return a full order that can be used directly for signing, and with an included signature, passed directly to the order creation endpoint.",
        parameters: [
          { $ref: "#/components/parameters/chainId" },
          { $ref: "#/components/parameters/safeAddress" },
          {
            in: "query",
            name: "sellToken",
            required: true,
            schema: {
              type: "string",
            },
            description:
              "The ERC-20 token symbol or address to be sold, if provided with the symbol do not try to infer the address.",
          },
          {
            in: "query",
            name: "buyToken",
            required: true,
            schema: {
              type: "string",
            },
            description:
              "The ERC-20 token symbol or address to be bought, if provided with the symbol do not try to infer the address..",
          },
          {
            in: "query",
            name: "receiver",
            required: false,
            schema: {
              type: "string",
            },
            description:
              "The address to receive the proceeds of the trade, instead of the sender's address.",
          },
          {
            in: "query",
            name: "sellAmountBeforeFee",
            required: true,
            schema: {
              type: "string",
            },
            description:
              "The amount of tokens to sell before fees, represented as a decimal string in token units. Not Atoms.",
          },
        ],
        requestBody: {
          description: "The order parameters to compute a quote for.",
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/OrderQuoteRequest",
              },
            },
          },
        },
        responses: {
          "200": { $ref: "#/components/responses/SignRequestResponse200" },
          "400": {
            description: "Error quoting order.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PriceEstimationError",
                },
              },
            },
          },
          "404": {
            description: "No route was found for the specified order.",
          },
          "429": {
            description: "Too many order quotes.",
          },
          "500": {
            description: "Unexpected error quoting an order.",
          },
        },
      },
    },
    "/api/tools/dexscreener-uniswap/buy-dip": {
      post: {
        tags: ["dexscreener-uniswap"],
        summary: "Check token price and display DexScreener data",
        description: "Displays token price data from DexScreener, including current price, price changes, liquidity, and volume. Checks if price has dropped by 66.66% or more within the last hour but does NOT automatically execute any transaction. This endpoint is purely informational and shows the token data first. If USE_NEAR_WALLET=true is set in the environment, wallet address detection will use your NEAR account. For NEAR wallet users, you can set walletAddress=0x0 and the backend will automatically detect your NEAR account.",
        operationId: "dexscreener-uniswap-buy-dip",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  chainId: {
                    type: "string",
                    description: "Chain ID (only 'base' is supported)",
                    example: "base"
                  },
                  tokenAddress: {
                    type: "string",
                    description: "Target token address to monitor and potentially buy (must be a valid ERC20 token address on Base)",
                    example: "0x4200000000000000000000000000000000000006"
                  },
                  sellTokenAddress: {
                    type: "string",
                    description: "Token address to sell when buying the dip (must be a valid ERC20 token address on Base)",
                    example: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // USDC on Base
                  },
                  sellAmount: {
                    type: "string",
                    description: "Amount of sell token to use for the swap (in token base units, e.g. for 5 USDC with 6 decimals, use '5000000')",
                    example: "5000000" // 5 USDC with 6 decimals
                  },
                  walletAddress: {
                    type: "string",
                    description: "Wallet address for the swap transaction. For NEAR wallet users, you can set this to '0x0' and the backend will automatically use your NEAR account.",
                    example: "0x1111111111111111111111111111111111111111"
                  },
                  forceSwap: {
                    type: "boolean",
                    description: "Force the swap regardless of price change (for testing purposes)",
                    example: true
                  }
                },
                required: ["chainId", "tokenAddress", "sellTokenAddress", "sellAmount", "walletAddress"]
              },
              examples: {
                "Buy WETH on dip": {
                  value: {
                    "chainId": "base",
                    "tokenAddress": "0x4200000000000000000000000000000000000006",
                    "sellTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                    "sellAmount": "5000000",
                    "walletAddress": "0x1111111111111111111111111111111111111111"
                  }
                },
                "Buy token with NEAR wallet": {
                  value: {
                    "chainId": "base",
                    "tokenAddress": "0xe6241e7fCc13574A9E79b807EFF0FA7D27a0401F",
                    "sellTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                    "sellAmount": "5",
                    "walletAddress": "0x0",
                    "forceSwap": true
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Buy dip operation result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    result: {
                      type: "string",
                      description: "Information about the token and whether a swap was triggered"
                    },
                    dip: {
                      type: "boolean",
                      description: "Whether a dip was detected"
                    },
                    priceChange: {
                      type: "number",
                      description: "Price change percentage in the last 5 minutes"
                    },
                    transaction: {
                      type: "object",
                      description: "Transaction data if a swap was triggered",
                      properties: {
                        tx: {
                          type: "object",
                          description: "Uniswap transaction data"
                        },
                        meta: {
                          type: "object",
                          description: "Metadata about the transaction"
                        }
                      }
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
                      example: "Missing required parameter or unsupported chain"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tools/dexscreener-uniswap/execute-swap": {
      post: {
        tags: ["dexscreener-uniswap"],
        summary: "Execute a token swap transaction",
        description: "Explicitly executes a swap transaction after the user has reviewed token data from the buy-dip endpoint. This endpoint actually performs the transaction. If USE_NEAR_WALLET=true is set in the environment, the transaction will use the NEAR wallet integration.",
        operationId: "dexscreener-uniswap-execute-swap",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  chainId: {
                    type: "string",
                    description: "Chain ID (only 'base' is supported)",
                    example: "base"
                  },
                  tokenAddress: {
                    type: "string",
                    description: "Target token address to buy (must be a valid ERC20 token address on Base)",
                    example: "0x4200000000000000000000000000000000000006"
                  },
                  sellTokenAddress: {
                    type: "string",
                    description: "Token address to sell (must be a valid ERC20 token address on Base)",
                    example: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // USDC on Base
                  },
                  sellAmount: {
                    type: "string",
                    description: "Amount of sell token to use for the swap (in token base units, e.g. for 5 USDC with 6 decimals, use '5000000')",
                    example: "5000000" // 5 USDC with 6 decimals
                  },
                  walletAddress: {
                    type: "string",
                    description: "Wallet address for the swap transaction. For NEAR wallet users, you can set this to '0x0' and the backend will automatically use your NEAR account.",
                    example: "0x1111111111111111111111111111111111111111"
                  }
                },
                required: ["chainId", "tokenAddress", "sellTokenAddress", "sellAmount", "walletAddress"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Swap transaction result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      description: "Success message"
                    },
                    transaction: {
                      type: "object",
                      description: "Transaction data",
                      properties: {
                        tx: {
                          type: "object",
                          description: "Uniswap transaction data"
                        }
                      }
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
                      example: "Missing required parameter"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tools/dexscreener-uniswap/test": {
      post: {
        tags: ["dexscreener-uniswap"],
        summary: "Test endpoint for API functionality",
        description: "Use this endpoint to test if the API is working correctly",
        operationId: "dexscreener-uniswap-test",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  testParam: {
                    type: "string",
                    description: "Any test parameter",
                    example: "test value"
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Test response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    received: {
                      type: "object",
                      description: "The parameters received in the request"
                    },
                    message: {
                      type: "string",
                      example: "Test endpoint successful"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/swap": {
      post: {
        operationId: "swap",
        summary: "Swap tokens on Uniswap",
        description: "Execute a swap transaction on Uniswap. If the token shows a significant price dip (>66.66%), the swap will be executed.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  buyToken: {
                    type: "string",
                    description: "The address of the token to buy"
                  },
                  sellToken: {
                    type: "string",
                    description: "The address of the token to sell"
                  },
                  sellAmountBeforeFee: {
                    type: "string",
                    description: "The amount to sell (in base units)"
                  },
                  safeAddress: {
                    type: "string",
                    description: "The wallet address to use for the swap"
                  },
                  chainId: {
                    oneOf: [
                      { type: "string", enum: ["base"] },
                      { type: "number", enum: [8453] }
                    ],
                    description: "The chain ID to use (only Base supported)"
                  }
                },
                required: ["buyToken", "sellToken", "sellAmountBeforeFee", "safeAddress"]
              }
            }
          }
        },
        responses: {
          200: {
            description: "Success response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      description: "Whether the swap was executed"
                    },
                    message: {
                      type: "string",
                      description: "Details about the swap result"
                    },
                    transactionHash: {
                      type: "string",
                      description: "The transaction hash (if swap was executed)"
                    }
                  }
                }
              }
            }
          },
          400: {
            description: "Bad request",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    meta: {
                      type: "object",
                      properties: {
                        message: {
                          type: "string",
                          description: "Error message"
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
    },
    "/api/tools/dexscreener-uniswap/token-price": {
      get: {
        operationId: "get-dexscreener-uniswap-token-price",
        summary: "Get token price information",
        description: "Fetches the current price and market data for a specific token on a blockchain",
        parameters: [
          {
            name: "tokenAddress",
            in: "query",
            description: "The address of the token to check",
            required: true,
            schema: {
              type: "string"
            }
          },
          {
            name: "chainId",
            in: "query",
            description: "The chain ID (default: base)",
            required: false,
            schema: {
              type: "string",
              default: "base"
            }
          }
        ],
        responses: {
          "200": {
            description: "Token price information successfully retrieved",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    result: {
                      type: "object",
                      properties: {
                        token: {
                          type: "object",
                          properties: {
                            address: { type: "string" },
                            symbol: { type: "string" },
                            name: { type: "string" }
                          }
                        },
                        price: {
                          type: "object",
                          properties: {
                            usd: { type: "string" },
                            nativeToken: { type: "string" }
                          }
                        },
                        priceChange: {
                          type: "object",
                          description: "Price change in different time periods"
                        },
                        liquidity: {
                          type: "object",
                          description: "Liquidity information"
                        },
                        volume: {
                          type: "object",
                          description: "Volume information"
                        },
                        pair: {
                          type: "object",
                          properties: {
                            address: { type: "string" },
                            dex: { type: "string" },
                            url: { type: "string" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            description: "Bad request - missing required parameters",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" }
                  }
                }
              }
            }
          },
          "404": {
            description: "Token not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    message: { type: "string" }
                  }
                }
              }
            }
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    message: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tools/near-wallet/safe-address": {
      get: {
        tags: ["near-wallet"],
        summary: "Get Safe Address for NEAR Account",
        description: "Returns the Safe address associated with a NEAR account on a specific chain. This endpoint is useful for checking the Safe address that will be used for transactions when using the NEAR wallet integration.",
        operationId: "get-near-safe-address",
        parameters: [
          { $ref: "#/components/parameters/chainId" }
        ],
        responses: {
          "200": {
            description: "Safe address information",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    nearAccountId: {
                      type: "string",
                      description: "The NEAR account ID",
                      example: "yoshitoke.near"
                    },
                    safeAddress: {
                      type: "string",
                      description: "The Safe address for the NEAR account",
                      example: "0xded0d75e60132f8837c892dbf7e19cba6497a0f7"
                    },
                    chainId: {
                      type: "number",
                      description: "The chain ID",
                      example: 8453
                    },
                    isDeployed: {
                      type: "boolean",
                      description: "Whether the Safe is deployed",
                      example: false
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
                      example: "Missing required parameter or NEAR wallet not configured"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tools/near-wallet/swap": {
      post: {
        tags: ["near-wallet"],
        summary: "Create and execute a Uniswap swap using NEAR wallet",
        description: "Create and execute a Uniswap swap transaction using the NEAR wallet integration. This endpoint is used for direct swapping without checking for price dips.",
        operationId: "near-wallet-swap",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  chainId: {
                    oneOf: [
                      { type: "string", description: "Chain ID string (e.g., 'base')" },
                      { type: "number", description: "Chain ID number (e.g., 8453)" }
                    ],
                    description: "Chain ID (only Base/8453 is fully supported)",
                    example: 8453
                  },
                  buyToken: {
                    type: "string",
                    description: "Token address to buy",
                    example: "0xe6241e7fCc13574A9E79b807EFF0FA7D27a0401F"
                  },
                  sellToken: {
                    type: "string",
                    description: "Token address to sell",
                    example: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
                  },
                  sellAmountBeforeFee: {
                    type: "string",
                    description: "Amount of sell token to use (as decimal string or in base units)",
                    example: "5"
                  }
                },
                required: ["chainId", "buyToken", "sellToken", "sellAmountBeforeFee"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Successful transaction",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      description: "Whether the transaction was successful"
                    },
                    nearAccountId: {
                      type: "string",
                      description: "The NEAR account ID used for the transaction"
                    },
                    safeAddress: {
                      type: "string",
                      description: "The Safe address used for the transaction"
                    },
                    transaction: {
                      type: "object",
                      description: "Transaction details"
                    }
                  }
                }
              }
            }
          },
          "400": {
            description: "Error creating transaction",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      description: "Error message"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tools/near-wallet/near-swap": {
      post: {
        tags: ["near-wallet"],
        summary: "Swap tokens using NEAR wallet",
        description: "Simplified endpoint for swapping tokens using a NEAR wallet. This endpoint automatically uses your NEAR account for wallet address detection and returns a signing URL for the transaction.",
        operationId: "near-wallet-near-swap",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  tokenAddress: {
                    type: "string",
                    description: "Target token address to buy (must be a valid ERC20 token address)",
                    example: "0x4200000000000000000000000000000000000006"
                  },
                  chainId: {
                    type: "string",
                    description: "Chain ID (defaults to 8453 for Base)",
                    example: "8453"
                  },
                  amount: {
                    type: "string",
                    description: "Amount of USDC to swap (defaults to 1000000 which is 1 USDC with 6 decimals)",
                    example: "1000000"
                  }
                },
                required: ["tokenAddress"]
              },
              examples: {
                "Swap USDC to WETH on Base": {
                  value: {
                    "tokenAddress": "0x4200000000000000000000000000000000000006",
                    "chainId": "8453",
                    "amount": "1000000"
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Swap transaction prepared successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      description: "Whether the transaction was prepared successfully"
                    },
                    message: {
                      type: "string",
                      description: "Message about the transaction"
                    },
                    nearAccountId: {
                      type: "string",
                      description: "NEAR account ID"
                    },
                    safeAddress: {
                      type: "string",
                      description: "Safe address for the NEAR account"
                    },
                    tokenData: {
                      type: "object",
                      description: "Token data from DexScreener"
                    },
                    signUrl: {
                      type: "string",
                      description: "URL to sign the transaction with the NEAR wallet"
                    },
                    instructions: {
                      type: "string",
                      description: "Instructions for signing the transaction"
                    }
                  }
                }
              }
            }
          },
          "400": {
            description: "Bad request - missing required parameters",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      description: "Error message"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tools/dexscreener-uniswap/near-buy-dip": {
      post: {
        tags: ["dexscreener-uniswap"],
        summary: "Check token price using NEAR wallet",
        description: "Special endpoint for NEAR wallet users. Displays token price data from DexScreener, including current price, price changes, liquidity, and volume. Automatically uses your NEAR account for wallet address detection. This endpoint is purely informational and shows the token data first.",
        operationId: "dexscreener-uniswap-near-buy-dip",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  chainId: {
                    type: "string",
                    description: "Chain ID (only 'base' is supported)",
                    example: "base"
                  },
                  tokenAddress: {
                    type: "string",
                    description: "Target token address to monitor (must be a valid ERC20 token address on Base)",
                    example: "0x4200000000000000000000000000000000000006"
                  },
                  sellTokenAddress: {
                    type: "string",
                    description: "Token address to sell (defaults to USDC on Base if not specified)",
                    example: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // USDC on Base
                  },
                  sellAmount: {
                    type: "string",
                    description: "Amount of sell token to use (defaults to 1000000 which is 1 USDC with 6 decimals)",
                    example: "1000000" // 1 USDC with 6 decimals
                  },
                  forceSwap: {
                    type: "boolean",
                    description: "Force the swap regardless of price change (for testing purposes)",
                    example: false
                  }
                },
                required: ["tokenAddress"]
              },
              examples: {
                "Check token on Base with NEAR wallet": {
                  value: {
                    "chainId": "base",
                    "tokenAddress": "0x4200000000000000000000000000000000000006"
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Token data retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      description: "Message about the token price change"
                    },
                    tokenData: {
                      type: "object",
                      description: "Token data from DexScreener"
                    },
                    nearInfo: {
                      type: "object",
                      description: "Information about the NEAR wallet"
                    }
                  }
                }
              }
            }
          },
          "400": {
            description: "Bad request - missing required parameters",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      description: "Error message"
                    }
                  }
                }
              }
            }
          },
          "404": {
            description: "Token not found on DexScreener",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      description: "Error message"
                    }
                  }
                }
              }
            }
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      description: "Error message"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
  },
  components: {
    parameters: {
      chainId: {
        name: "chainId",
        in: "query",
        description:
          "EVM Network on which to assests live and transactions are to be constructed",
        required: true,
        schema: {
          type: "number",
        },
        example: 100,
      },
      amount: {
        name: "amount",
        in: "query",
        description: "amount in Units",
        required: true,
        schema: {
          type: "number",
        },
        example: 0.123,
      },
      address: {
        name: "address",
        in: "query",
        description:
          "20 byte Ethereum address encoded as a hex with `0x` prefix.",
        required: true,
        schema: {
          type: "string",
        },
        example: "0x6810e776880c02933d47db1b9fc05908e5386b96",
      },
      safeAddress: {
        name: "safeAddress",
        in: "query",
        required: true,
        description: "The Safe address (i.e. the connected user address)",
        schema: {
          $ref: "#/components/schemas/Address",
        },
      },
      recipient: {
        name: "recipient",
        in: "query",
        required: true,
        description: "Recipient address of the transferred token.",
        schema: {
          $ref: "#/components/schemas/Address",
        },
      },
      token: {
        name: "token",
        in: "query",
        description: "Token address to be transferred.",
        schema: {
          $ref: "#/components/schemas/Address",
        },
      },
    },
    responses: {
      SignRequest200: {
        description: "Generic Structure representing an EVM Signature Request",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/SignRequest",
            },
          },
        },
      },
      SignRequestResponse200: {
        description:
          "Uniswap Fusion order response including transaction and order URL",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                transaction: {
                  $ref: "#/components/schemas/SignRequest",
                },
                meta: {
                  type: "object",
                  description: "Additional metadata related to the transaction",
                  additionalProperties: true,
                  example: {
                    message: "Order submitted successfully",
                  },
                },
              },
              required: ["transaction"],
            },
          },
        },
      },
      BadRequest400: {
        description: "Bad Request - Invalid or missing parameters",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                ok: {
                  type: "boolean",
                  example: false,
                },
                message: {
                  type: "string",
                  example: "Missing required parameters: chainId or amount",
                },
              },
            },
          },
        },
      },
    },
    schemas: {
      Address: {
        description:
          "20 byte Ethereum address encoded as a hex with `0x` prefix.",
        type: "string",
        example: "0x6810e776880c02933d47db1b9fc05908e5386b96",
      },
      SignRequest: {
        type: "object",
        required: ["method", "chainId", "params"],
        properties: {
          method: {
            type: "string",
            enum: [
              "eth_sign",
              "personal_sign",
              "eth_sendTransaction",
              "eth_signTypedData",
              "eth_signTypedData_v4",
            ],
            description: "The signing method to be used.",
            example: "eth_sendTransaction",
          },
          chainId: {
            type: "integer",
            description:
              "The ID of the Ethereum chain where the transaction or signing is taking place.",
            example: 100,
          },
          params: {
            oneOf: [
              {
                type: "array",
                items: {
                  $ref: "#/components/schemas/MetaTransaction",
                },
                description: "An array of Ethereum transaction parameters.",
              },
              {
                type: "array",
                items: {
                  type: "string",
                },
                description: "Parameters for personal_sign request",
                example: [
                  "0x4578616d706c65206d657373616765",
                  "0x0000000000000000000000000000000000000001",
                ],
              },
              {
                type: "array",
                items: {
                  type: "string",
                },
                description: "Parameters for eth_sign request",
                example: [
                  "0x0000000000000000000000000000000000000001",
                  "0x4578616d706c65206d657373616765",
                ],
              },
              {
                type: "array",
                items: {
                  type: "string",
                },
                description:
                  "Parameters for signing structured data (TypedDataParams)",
                example: [
                  "0x0000000000000000000000000000000000000001",
                  '{"data": {"types": {"EIP712Domain": [{"name": "name","type": "string"}]}}}',
                ],
              },
            ],
          },
        },
      },
      MetaTransaction: {
        description: "Sufficient data representing an EVM transaction",
        type: "object",
        properties: {
          to: {
            $ref: "#/components/schemas/Address",
            description: "Recipient address",
          },
          data: {
            type: "string",
            description: "Transaction calldata",
            example: "0xd0e30db0",
          },
          value: {
            type: "string",
            description: "Transaction value",
            example: "0x1b4fbd92b5f8000",
          },
        },
        required: ["to", "data", "value"],
      },
      SellTokenSource: {
        description: "Where should the `sellToken` be drawn from?",
        type: "string",
        enum: ["erc20", "internal", "external"],
      },
      BuyTokenDestination: {
        description: "Where should the `buyToken` be transferred to?",
        type: "string",
        enum: ["erc20", "internal"],
      },
      PriceQuality: {
        description:
          "How good should the price estimate be?\n\nFast: The price estimate is chosen among the fastest N price estimates.\nOptimal: The price estimate is chosen among all price estimates.\nVerified: The price estimate is chosen among all verified/simulated price estimates.\n\n**NOTE**: Orders are supposed to be created from `verified` or `optimal` price estimates.",
        type: "string",
        enum: ["fast", "optimal", "verified"],
      },
      SigningScheme: {
        description: "How was the order signed?",
        type: "string",
        enum: ["eip712", "ethsign", "presign", "eip1271"],
      },
      EcdsaSigningScheme: {
        description: "How was the order signed?",
        type: "string",
        enum: ["eip712", "ethsign"],
      },
      Signature: {
        description: "A signature.",
        oneOf: [
          { $ref: "#/components/schemas/EcdsaSignature" },
          { $ref: "#/components/schemas/PreSignature" },
        ],
      },
      EcdsaSignature: {
        description:
          "65 bytes encoded as hex with `0x` prefix. `r || s || v` from the spec.",
        type: "string",
        example:
          "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      },
      PreSignature: {
        description: 'Empty signature bytes. Used for "presign" signatures.',
        type: "string",
        example: "0x",
      },
      OrderQuoteRequest: {
        description: "Request fee and price quote.",
        allOf: [
          { $ref: "#/components/schemas/OrderQuoteSide" },
          { $ref: "#/components/schemas/OrderQuoteValidity" },
          {
            type: "object",
            properties: {
              sellToken: {
                description: "ERC-20 token to be sold",
                allOf: [{ $ref: "#/components/schemas/Address" }],
              },
              buyToken: {
                description: "ERC-20 token to be bought",
                allOf: [{ $ref: "#/components/schemas/Address" }],
              },
              receiver: {
                description:
                  "An optional address to receive the proceeds of the trade instead of the `owner` (i.e. the order signer).",
                allOf: [{ $ref: "#/components/schemas/Address" }],
                nullable: true,
              },
              sellTokenBalance: {
                allOf: [{ $ref: "#/components/schemas/SellTokenSource" }],
                default: "erc20",
              },
              buyTokenBalance: {
                allOf: [{ $ref: "#/components/schemas/BuyTokenDestination" }],
                default: "erc20",
              },
              from: { $ref: "#/components/schemas/Address" },
              priceQuality: {
                allOf: [{ $ref: "#/components/schemas/PriceQuality" }],
                default: "verified",
              },
              signingScheme: {
                allOf: [{ $ref: "#/components/schemas/SigningScheme" }],
                default: "eip712",
              },
              onchainOrder: {
                description:
                  "Flag to signal whether the order is intended for on-chain order placement. Only valid for non ECDSA-signed orders.",
                default: false,
              },
              network: {
                description: "The network on which the order is to be placed.",
                type: "string",
                enum: ["mainnet", "xdai", "arbitrum_one"],
              },
            },
            required: ["sellToken", "buyToken", "from"],
          },
        ],
      },
      OrderQuoteResponse: {
        description:
          "An order quoted by the backend that can be directly signed and submitted to the order creation backend.",
        type: "object",
        properties: {
          quote: { $ref: "#/components/schemas/OrderParameters" },
          from: { $ref: "#/components/schemas/Address" },
          expiration: {
            description:
              "Expiration date of the offered fee. Order service might not accept the fee after this expiration date. Encoded as ISO 8601 UTC.",
            type: "string",
            example: "1985-03-10T18:35:18.814523Z",
          },
          id: {
            description:
              "Quote ID linked to a quote to enable providing more metadata when analysing order slippage.",
            type: "integer",
          },
          verified: {
            description:
              "Whether it was possible to verify that the quoted amounts are accurate using a simulation.",
            type: "boolean",
          },
        },
        required: ["quote", "expiration", "verified"],
      },
      PriceEstimationError: {
        type: "object",
        properties: {
          errorType: {
            type: "string",
            enum: [
              "QuoteNotVerified",
              "UnsupportedToken",
              "ZeroAmount",
              "UnsupportedOrderType",
            ],
          },
          description: { type: "string" },
        },
        required: ["errorType", "description"],
      },
      OrderKind: {
        description: "Is this order a buy or sell?",
        type: "string",
        enum: ["buy", "sell"],
      },
      OrderParameters: {
        description: "Order parameters.",
        type: "object",
        properties: {
          sellToken: {
            description: "ERC-20 token to be sold.",
            allOf: [{ $ref: "#/components/schemas/Address" }],
          },
          buyToken: {
            description: "ERC-20 token to be bought.",
            allOf: [{ $ref: "#/components/schemas/Address" }],
          },
          receiver: {
            description:
              "An optional Ethereum address to receive the proceeds of the trade instead of the owner (i.e. the order signer).",
            allOf: [{ $ref: "#/components/schemas/Address" }],
            nullable: true,
          },
          sellAmount: {
            description: "Amount of `sellToken` to be sold in atoms.",
            allOf: [{ $ref: "#/components/schemas/TokenAmount" }],
          },
          buyAmount: {
            description: "Amount of `buyToken` to be bought in atoms.",
            allOf: [{ $ref: "#/components/schemas/TokenAmount" }],
          },
          validTo: {
            description:
              "Unix timestamp (`uint32`) until which the order is valid.",
            type: "integer",
          },
          feeAmount: {
            description: "feeRatio * sellAmount + minimal_fee in atoms.",
            allOf: [{ $ref: "#/components/schemas/TokenAmount" }],
          },
          kind: {
            description: "The kind is either a buy or sell order.",
            allOf: [{ $ref: "#/components/schemas/OrderKind" }],
          },
          partiallyFillable: {
            description: "Is the order fill-or-kill or partially fillable?",
            type: "boolean",
          },
          sellTokenBalance: {
            allOf: [{ $ref: "#/components/schemas/SellTokenSource" }],
            default: "erc20",
          },
          buyTokenBalance: {
            allOf: [{ $ref: "#/components/schemas/BuyTokenDestination" }],
            default: "erc20",
          },
          signingScheme: {
            allOf: [{ $ref: "#/components/schemas/SigningScheme" }],
            default: "eip712",
          },
        },
        required: [
          "sellToken",
          "buyToken",
          "sellAmount",
          "buyAmount",
          "validTo",
          "appData",
          "feeAmount",
          "kind",
          "partiallyFillable",
        ],
      },
      OrderQuoteSide: {
        description: "The buy or sell side when quoting an order.",
        oneOf: [
          {
            type: "object",
            description:
              "Quote a sell order given the final total `sellAmount` including fees.",
            properties: {
              kind: {
                allOf: [
                  {
                    $ref: "#/components/schemas/OrderQuoteSideKindSell",
                  },
                ],
              },
              sellAmountBeforeFee: {
                description:
                  "The total amount that is available for the order. From this value, the fee is deducted and the buy amount is calculated.",
                allOf: [
                  {
                    $ref: "#/components/schemas/TokenAmount",
                  },
                ],
              },
            },
            required: ["kind", "sellAmountBeforeFee"],
          },
          {
            type: "object",
            description: "Quote a sell order given the `sellAmount`.",
            properties: {
              kind: {
                allOf: [
                  {
                    $ref: "#/components/schemas/OrderQuoteSideKindSell",
                  },
                ],
              },
              sellAmountAfterFee: {
                description: "The `sellAmount` for the order.",
                allOf: [
                  {
                    $ref: "#/components/schemas/TokenAmount",
                  },
                ],
              },
            },
            required: ["kind", "sellAmountAfterFee"],
          },
          {
            type: "object",
            description: "Quote a buy order given an exact `buyAmount`.",
            properties: {
              kind: {
                allOf: [
                  {
                    $ref: "#/components/schemas/OrderQuoteSideKindBuy",
                  },
                ],
              },
              buyAmountAfterFee: {
                description: "The `buyAmount` for the order.",
                allOf: [
                  {
                    $ref: "#/components/schemas/TokenAmount",
                  },
                ],
              },
            },
            required: ["kind", "buyAmountAfterFee"],
          },
        ],
      },
      OrderQuoteSideKindSell: {
        type: "string",
        enum: ["sell"],
      },
      OrderQuoteSideKindBuy: {
        type: "string",
        enum: ["buy"],
      },
      TokenAmount: {
        description: "Amount of a token. `uint256` encoded in decimal.",
        type: "string",
        example: "1234567890",
      },
      OrderQuoteValidity: {
        description: "The validity for the order.",
        oneOf: [
          {
            type: "object",
            description: "Absolute validity.",
            properties: {
              validTo: {
                description:
                  "Unix timestamp (`uint32`) until which the order is valid.",
                type: "integer",
              },
            },
          },
          {
            type: "object",
            description: "Relative validity",
            properties: {
              validFor: {
                description:
                  "Number (`uint32`) of seconds that the order should be valid for.",
                type: "integer",
              },
            },
          },
        ],
      },
    },
  },
  "x-readme": {
    "explorer-enabled": true,
    "proxy-enabled": true,
  },
};
