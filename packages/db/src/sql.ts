/**
 * Query-building helpers, re-exported so consumers never depend on drizzle-orm
 * directly.
 *
 * Declaring drizzle-orm in a second workspace package installs a second physical
 * copy of it, and column types from two copies are not assignable to each other:
 * `eq(incident.id, …)` fails to typecheck with an unreadable error about
 * separate declarations of a private property. Routing every consumer through
 * this module keeps exactly one instance in the graph.
 */

export {
	and,
	asc,
	between,
	count,
	countDistinct,
	desc,
	eq,
	gt,
	gte,
	ilike,
	inArray,
	isNotNull,
	isNull,
	lt,
	lte,
	max,
	min,
	ne,
	not,
	notInArray,
	or,
	sql,
} from "drizzle-orm";
