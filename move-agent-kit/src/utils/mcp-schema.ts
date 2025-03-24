import { z } from "zod"

/**
 * Represents the shape of a Move Contract Protocol (MCP) schema
 * Each key maps to a Zod type that defines the validation rules
 */
export type MoveSchemaShape = {
	[key: string]: z.ZodTypeAny
}

/**
 * Type guard to check if a schema is an optional type
 */
const isOptionalSchema = (schema: z.ZodTypeAny): schema is z.ZodOptional<z.ZodTypeAny> => {
	return schema instanceof z.ZodOptional
}

/**
 * Type guard to check if a schema is an object type
 */
const isObjectSchema = (schema: z.ZodTypeAny): schema is z.ZodObject<Record<string, z.ZodTypeAny>> => {
	return schema instanceof z.ZodObject || schema?._def?.typeName === "ZodObject"
}

/**
 * Type guard to check if a schema is an array type
 */
const isArraySchema = (schema: z.ZodTypeAny): schema is z.ZodArray<z.ZodTypeAny> => {
	return schema instanceof z.ZodArray
}

/**
 * Processes a Zod schema to extract its shape and metadata
 * @param schema The Zod schema to process
 * @returns An object containing the processed schema shape and metadata
 * @throws Error if the schema is not an object type
 */
export function processMoveSchema(schema: z.ZodTypeAny): {
	shape: MoveSchemaShape
	keys: string[]
	requiredKeys: string[]
	optionalKeys: string[]
} {
	if (!isObjectSchema(schema)) {
		console.warn("Schema is not an object type, returning empty schema")
		return {
			shape: {},
			keys: [],
			requiredKeys: [],
			optionalKeys: [],
		}
	}

	const shape = schema.shape as Record<string, z.ZodTypeAny>

	// Safety check - if shape is undefined or null, return empty schema
	if (!shape) {
		console.warn("Schema shape is undefined or null, returning empty schema")
		return {
			shape: {},
			keys: [],
			requiredKeys: [],
			optionalKeys: [],
		}
	}

	const processedShape: MoveSchemaShape = {}
	const requiredKeys: string[] = []
	const optionalKeys: string[] = []

	// Use a try/catch block to handle potential errors
	try {
		for (const [key, value] of Object.entries(shape)) {
			if (!value) continue // Skip if value is null or undefined

			const zodValue = value as z.ZodTypeAny
			if (isOptionalSchema(zodValue)) {
				processedShape[key] = zodValue.unwrap()
				optionalKeys.push(key)
			} else {
				processedShape[key] = zodValue
				requiredKeys.push(key)
			}
		}
	} catch (error) {
		console.error("Error processing schema:", error)
		// Return a minimal valid result if processing fails
		return {
			shape: processedShape,
			keys: Object.keys(processedShape),
			requiredKeys,
			optionalKeys,
		}
	}

	return {
		shape: processedShape,
		keys: Object.keys(processedShape),
		requiredKeys,
		optionalKeys,
	}
}

/**
 * Validates a schema against Move-specific constraints
 * @param schema The schema to validate
 * @returns true if the schema is valid for Move
 */
export function validateMoveSchema(schema: z.ZodTypeAny): boolean {
	if (!isObjectSchema(schema)) {
		return false
	}

	const shape = schema.shape as Record<string, z.ZodTypeAny>
	if (!shape) return false

	// Check for unsupported types in Move
	try {
		for (const value of Object.values(shape)) {
			if (!value) continue // Skip if value is null or undefined

			const zodValue = value as z.ZodTypeAny
			if (isArraySchema(zodValue)) {
				// Move has specific array type requirements
				return false
			}
		}
	} catch (error) {
		console.error("Error validating schema:", error)
		return false
	}

	return true
}

/**
 * Creates a new Move schema with default values
 * @param schema The base schema
 * @param defaults Default values for optional fields
 * @returns A new schema with default values applied
 */
export function createMoveSchemaWithDefaults(schema: z.ZodTypeAny, defaults: Record<string, unknown>): z.ZodTypeAny {
	if (!isObjectSchema(schema)) {
		throw new Error("Schema must be an object type")
	}

	const shape = schema.shape as Record<string, z.ZodTypeAny>
	if (!shape) {
		return z.object({})
	}

	const newShape: Record<string, z.ZodTypeAny> = {}

	try {
		for (const [key, value] of Object.entries(shape)) {
			if (!value) continue // Skip if value is null or undefined

			const zodValue = value as z.ZodTypeAny
			if (isOptionalSchema(zodValue) && key in defaults) {
				newShape[key] = zodValue.default(defaults[key])
			} else {
				newShape[key] = zodValue
			}
		}
	} catch (error) {
		console.error("Error creating schema with defaults:", error)
		return schema // Return original schema if processing fails
	}

	return z.object(newShape)
}
