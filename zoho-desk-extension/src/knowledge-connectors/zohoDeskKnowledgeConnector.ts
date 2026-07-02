import { createKnowledgeConnector, IKnowledge } from "@cognigy/extension-tools";

import { chunkText, normalizePlainText, sanitizeDescriptionLabel, stripHtml } from "../lib/text";
import { IZohoDeskConnection } from "../lib/types";
import { integerInRange, optionalBoolean, optionalText, requiredText } from "../lib/validation";
import { zohoDeskRequest } from "../lib/zohoDeskClient";

const DEFAULT_SOURCE_PREFIX = "Zoho Desk";
const DEFAULT_MAX_ARTICLES = 50;
const DEFAULT_MAX_CHUNK_CHARACTERS = 2000;
const MIN_MAX_ARTICLES = 1;
const MAX_MAX_ARTICLES = 500;
const MIN_CHUNK_CHARACTERS = 500;
const MAX_CHUNK_CHARACTERS = 3000;
const ARTICLE_PAGE_SIZE = 50;
const ROOT_CATEGORY_PAGE_SIZE = 700;
const MAX_ROOT_CATEGORY_PAGES = 20;
const DEFAULT_TAGS = [
	"zoho-desk",
	"articles"
];

type ZohoId = string;

interface IZohoListResponse<T> {
	data?: T[];
}

interface IZohoTranslation {
	name?: string;
	description?: string | null;
	id?: string;
	locale?: string;
	categoryId?: string;
	permalink?: string;
}

export interface IZohoKnowledgeCategory {
	id?: ZohoId;
	name?: string;
	description?: string | null;
	rootCategoryId?: ZohoId;
	parentCategoryId?: ZohoId;
	locale?: string;
	translations?: IZohoTranslation[];
	children?: IZohoKnowledgeCategory[];
}

interface IZohoArticleListItem {
	id?: ZohoId;
	title?: string;
	summary?: string;
	categoryId?: ZohoId;
	rootCategoryId?: ZohoId;
	latestPublishedVersion?: string | null;
	latestVersion?: string | null;
	translationId?: string;
	modifiedTime?: string;
	status?: string;
	permission?: string;
	locale?: string;
}

interface IZohoArticleDetail extends IZohoArticleListItem {
	answer?: string;
	articleNumber?: string;
	portalUrl?: string;
	webUrl?: string;
	category?: {
		id?: string;
		name?: string;
		locale?: string;
	};
}

interface IResolvedScope {
	scopeKey: string;
	scopeLabel: string;
	rootCategoryId?: ZohoId;
	rootCategoryName?: string;
	selectedCategoryId?: ZohoId;
	selectedCategoryName?: string;
	categoryIds: ZohoId[];
	exhaustive: boolean;
}

interface IArticleCandidate {
	item: IZohoArticleListItem;
	categoryId?: ZohoId;
}

interface IListArticlesResult {
	articles: IArticleCandidate[];
	truncated: boolean;
}

const fields = [
	{
		key: "connection",
		label: "Zoho Desk Connection",
		type: "connection",
		params: {
			connectionType: "zoho-desk-oauth",
			required: true
		}
	},
	{
		key: "knowledgeSourcePrefix",
		label: "Knowledge Source Prefix",
		type: "text",
		defaultValue: DEFAULT_SOURCE_PREFIX,
		description: "Prefix used for Cognigy Knowledge Source names."
	},
	{
		key: "rootCategoryName",
		label: "Root Category Name",
		type: "text",
		description: "Optional root Knowledge Base category name, for example Support."
	},
	{
		key: "categoryPath",
		label: "Category Path",
		type: "text",
		description: "Optional path below the root, for example Getting Started / Agents."
	},
	{
		key: "rootCategoryId",
		label: "Root Category ID",
		type: "text",
		description: "Optional exact root category ID for duplicate-name cases."
	},
	{
		key: "categoryId",
		label: "Category ID",
		type: "text",
		description: "Optional exact category or section ID for duplicate-name cases."
	},
	{
		key: "includeChildCategories",
		label: "Include Child Categories",
		type: "toggle",
		defaultValue: true,
		description: "Import the selected category and all descendants."
	},
	{
		key: "permission",
		label: "Permission",
		type: "text",
		description: "Optional article permission filter: ALL, REGISTEREDUSERS, or AGENTS."
	},
	{
		key: "maxArticles",
		label: "Maximum Articles",
		type: "number",
		defaultValue: DEFAULT_MAX_ARTICLES,
		params: {
			min: MIN_MAX_ARTICLES,
			max: MAX_MAX_ARTICLES
		}
	},
	{
		key: "maxChunkCharacters",
		label: "Maximum Chunk Characters",
		type: "number",
		defaultValue: DEFAULT_MAX_CHUNK_CHARACTERS,
		params: {
			min: MIN_CHUNK_CHARACTERS,
			max: MAX_CHUNK_CHARACTERS
		}
	},
	{
		key: "tags",
		label: "Tags",
		type: "chipInput",
		defaultValue: DEFAULT_TAGS,
		description: "Tags added to each Knowledge Source."
	}
] as const;

const uniqueTags = (value: unknown): string[] => {
	const rawTags = Array.isArray(value) ? value : [];
	const tags: string[] = [];
	const seen = new Set<string>();

	for (const tag of [
		...DEFAULT_TAGS,
		...rawTags
	]) {
		const text = typeof tag === "string" ? tag.trim() : "";
		const key = text.toLowerCase();

		if (text && !seen.has(key)) {
			tags.push(text);
			seen.add(key);
		}
	}

	return tags;
};

const normalizeName = (value: string): string => value.trim().replace(/\s+/g, " ").toLowerCase();

const getCategoryNames = (category: IZohoKnowledgeCategory): string[] => {
	const names: string[] = [];

	if (category.name) {
		names.push(category.name);
	}

	for (const translation of category.translations || []) {
		if (translation.name) {
			names.push(translation.name);
		}
	}

	return names;
};

const getPrimaryCategoryName = (category: IZohoKnowledgeCategory): string => {
	return category.name || getCategoryNames(category)[0] || category.id || "Unnamed category";
};

const categoryMatchesName = (category: IZohoKnowledgeCategory, name: string): boolean => {
	const normalizedName = normalizeName(name);
	return getCategoryNames(category).some((candidateName: string) => normalizeName(candidateName) === normalizedName);
};

const formatCategory = (category: IZohoKnowledgeCategory): string => {
	return `${getPrimaryCategoryName(category)} (${category.id || "unknown id"})`;
};

const getCategoryId = (category: IZohoKnowledgeCategory, label: string): ZohoId => {
	if (!category.id) {
		throw new Error(`${label} did not include an id.`);
	}

	return String(category.id);
};

const stableTextValue = (value: unknown): string | undefined => {
	const text = optionalText(value);

	if (!text || text.toLowerCase() === "null") {
		return undefined;
	}

	return text;
};

const flattenCategories = (category: IZohoKnowledgeCategory): IZohoKnowledgeCategory[] => {
	const categories = [
		category
	];

	for (const child of category.children || []) {
		categories.push(...flattenCategories(child));
	}

	return categories;
};

const findCategoryById = (category: IZohoKnowledgeCategory, categoryId: string): IZohoKnowledgeCategory | undefined => {
	if (String(category.id) === categoryId) {
		return category;
	}

	for (const child of category.children || []) {
		const match = findCategoryById(child, categoryId);

		if (match) {
			return match;
		}
	}

	return undefined;
};

const findChildByName = (parent: IZohoKnowledgeCategory, segment: string, pathSoFar: string): IZohoKnowledgeCategory => {
	const matches = (parent.children || []).filter((child: IZohoKnowledgeCategory) => categoryMatchesName(child, segment));

	if (matches.length === 0) {
		throw new Error(`Zoho Desk category path segment "${segment}" was not found under "${pathSoFar}".`);
	}

	if (matches.length > 1) {
		throw new Error(`Zoho Desk category path segment "${segment}" is ambiguous under "${pathSoFar}". Use Category ID. Matches: ${matches.map(formatCategory).join(", ")}.`);
	}

	return matches[0];
};

const splitCategoryPath = (categoryPath: string | undefined): string[] => {
	return (categoryPath || "")
		.split("/")
		.map((segment: string) => segment.trim())
		.filter(Boolean);
};

const resolveCategoryPath = (root: IZohoKnowledgeCategory, categoryPath: string): IZohoKnowledgeCategory => {
	let current = root;
	let pathSoFar = getPrimaryCategoryName(root);

	for (const segment of splitCategoryPath(categoryPath)) {
		current = findChildByName(current, segment, pathSoFar);
		pathSoFar = `${pathSoFar} / ${getPrimaryCategoryName(current)}`;
	}

	return current;
};

export const validatePermission = (value: unknown): string | undefined => {
	const permission = optionalText(value);

	if (!permission) {
		return undefined;
	}

	const normalizedPermission = permission.toUpperCase();
	const allowedPermissions = [
		"ALL",
		"REGISTEREDUSERS",
		"AGENTS"
	];

	if (allowedPermissions.indexOf(normalizedPermission) === -1) {
		throw new Error("Permission must be empty, ALL, REGISTEREDUSERS, or AGENTS.");
	}

	return normalizedPermission;
};

const buildScopeKey = (
	rootCategoryId: string | undefined,
	selectedCategoryId: string | undefined,
	includeChildCategories: boolean,
	permission: string | undefined
): string => {
	return [
		`root-${rootCategoryId || "all"}`,
		`category-${selectedCategoryId || "all"}`,
		`children-${includeChildCategories ? "true" : "false"}`,
		`permission-${permission || "any"}`
	].join(":");
};

const buildScopeLabel = (root: IZohoKnowledgeCategory | undefined, selected: IZohoKnowledgeCategory | undefined, includeChildCategories: boolean): string => {
	if (!root && !selected) {
		return "All articles";
	}

	const rootName = root ? getPrimaryCategoryName(root) : "Category";

	if (!selected || (root && selected.id === root.id)) {
		return includeChildCategories ? `${rootName} subtree` : rootName;
	}

	const selectedName = getPrimaryCategoryName(selected);
	return includeChildCategories ? `${rootName}: ${selectedName} subtree` : `${rootName}: ${selectedName}`;
};

const listRootCategories = async (connection: IZohoDeskConnection): Promise<IZohoKnowledgeCategory[]> => {
	const categories: IZohoKnowledgeCategory[] = [];

	for (let page = 0; page < MAX_ROOT_CATEGORY_PAGES; page += 1) {
		const response = await zohoDeskRequest<IZohoListResponse<IZohoKnowledgeCategory>>(connection, {
			method: "GET",
			path: "/kbRootCategories",
			params: {
				from: page * ROOT_CATEGORY_PAGE_SIZE,
				limit: ROOT_CATEGORY_PAGE_SIZE,
				include: "publicArticlesCount,allArticlesCount,publishedArticleCount,sectionsCount"
			}
		});
		const pageCategories = Array.isArray(response.data) ? response.data : [];

		categories.push(...pageCategories);

		if (pageCategories.length < ROOT_CATEGORY_PAGE_SIZE) {
			break;
		}
	}

	return categories;
};

const resolveRootCategoryByName = async (connection: IZohoDeskConnection, rootCategoryName: string): Promise<IZohoKnowledgeCategory> => {
	const rootCategories = await listRootCategories(connection);
	const matches = rootCategories.filter((category: IZohoKnowledgeCategory) => categoryMatchesName(category, rootCategoryName));

	if (matches.length === 0) {
		throw new Error(`Zoho Desk root category "${rootCategoryName}" was not found.`);
	}

	if (matches.length > 1) {
		throw new Error(`Zoho Desk root category "${rootCategoryName}" is ambiguous. Use Root Category ID. Matches: ${matches.map(formatCategory).join(", ")}.`);
	}

	return matches[0];
};

const getCategoryTree = async (
	connection: IZohoDeskConnection,
	rootCategoryId: string
): Promise<IZohoKnowledgeCategory> => {
	return zohoDeskRequest<IZohoKnowledgeCategory>(connection, {
		method: "GET",
		path: `/kbRootCategories/${encodeURIComponent(rootCategoryId)}/categoryTree`,
		params: {
			sortBy: "order",
			includeTrash: false,
			include: "publicArticlesCount,allArticlesCount,publishedArticleCount,publishedArticleTemplateCount"
		}
	});
};

export const resolveArticleScope = async (
	connection: IZohoDeskConnection,
	config: {
		rootCategoryName?: unknown;
		categoryPath?: unknown;
		rootCategoryId?: unknown;
		categoryId?: unknown;
		includeChildCategories?: unknown;
		permission?: unknown;
	}
): Promise<IResolvedScope> => {
	const rootCategoryIdValue = optionalText(config.rootCategoryId);
	const rootCategoryName = optionalText(config.rootCategoryName);
	const categoryPath = optionalText(config.categoryPath);
	const categoryId = optionalText(config.categoryId);
	const includeChildCategories = optionalBoolean(config.includeChildCategories, true);
	const permission = validatePermission(config.permission);

	if (!rootCategoryIdValue && !rootCategoryName && categoryPath) {
		throw new Error("Root Category Name or Root Category ID is required when Category Path is set.");
	}

	if (!rootCategoryIdValue && !rootCategoryName && categoryId && includeChildCategories) {
		throw new Error("Root Category Name or Root Category ID is required when Category ID is used with Include Child Categories.");
	}

	if (!rootCategoryIdValue && !rootCategoryName) {
		return {
			scopeKey: buildScopeKey(undefined, categoryId, false, permission),
			scopeLabel: categoryId ? `Category ${categoryId}` : "All articles",
			selectedCategoryId: categoryId,
			categoryIds: categoryId ? [
				categoryId
			] : [],
			exhaustive: true
		};
	}

	const rootCategory = rootCategoryIdValue
		? {
			id: rootCategoryIdValue,
			name: rootCategoryName || rootCategoryIdValue
		}
		: await resolveRootCategoryByName(connection, requiredText(rootCategoryName, "Root Category Name"));
	const rootCategoryId = getCategoryId(rootCategory, "Zoho Desk root category");
	const tree = await getCategoryTree(connection, rootCategoryId);
	const selectedCategory = categoryId
		? findCategoryById(tree, categoryId)
		: categoryPath
			? resolveCategoryPath(tree, categoryPath)
			: tree;

	if (!selectedCategory) {
		throw new Error(`Zoho Desk category ID "${categoryId}" was not found under root category ${rootCategoryId}.`);
	}

	const selectedCategoryId = getCategoryId(selectedCategory, "Zoho Desk selected category");
	const categories = includeChildCategories
		? flattenCategories(selectedCategory)
		: [
			selectedCategory
		];
	const categoryIds = categories.map((category: IZohoKnowledgeCategory) => getCategoryId(category, "Zoho Desk category"));

	return {
		scopeKey: buildScopeKey(rootCategoryId, selectedCategoryId, includeChildCategories, permission),
		scopeLabel: buildScopeLabel(tree, selectedCategory, includeChildCategories),
		rootCategoryId,
		rootCategoryName: getPrimaryCategoryName(tree),
		selectedCategoryId,
		selectedCategoryName: getPrimaryCategoryName(selectedCategory),
		categoryIds,
		exhaustive: true
	};
};

export const listArticlesForCategories = async (
	connection: IZohoDeskConnection,
	categoryIds: string[],
	maxArticles: number,
	permission: string | undefined
): Promise<IListArticlesResult> => {
	const categoryQueue = categoryIds.length ? categoryIds : [
		undefined
	];
	const articles: IArticleCandidate[] = [];
	const seenArticleIds = new Set<string>();
	let truncated = false;

	for (let categoryIndex = 0; categoryIndex < categoryQueue.length; categoryIndex += 1) {
		const categoryId = categoryQueue[categoryIndex];
		let from = 0;
		let exhaustedCategory = false;

		while (articles.length < maxArticles) {
			const params: Record<string, unknown> = {
				from,
				limit: ARTICLE_PAGE_SIZE,
				status: "Published"
			};

			if (categoryId) {
				params.categoryId = categoryId;
			}

			if (permission) {
				params.permission = permission;
			}

			const response = await zohoDeskRequest<IZohoListResponse<IZohoArticleListItem>>(connection, {
				method: "GET",
				path: "/articles",
				params
			});
			const pageArticles = Array.isArray(response.data) ? response.data : [];

			for (const item of pageArticles) {
				if (!item.id || seenArticleIds.has(String(item.id))) {
					continue;
				}

				if (articles.length >= maxArticles) {
					truncated = true;
					break;
				}

				seenArticleIds.add(String(item.id));
				articles.push({
					item,
					categoryId
				});
			}

			if (truncated || pageArticles.length < ARTICLE_PAGE_SIZE) {
				exhaustedCategory = pageArticles.length < ARTICLE_PAGE_SIZE;
				break;
			}

			from += ARTICLE_PAGE_SIZE;
		}

		if (truncated) {
			break;
		}

		if (!exhaustedCategory && articles.length >= maxArticles) {
			truncated = true;
			break;
		}

		if (exhaustedCategory && articles.length >= maxArticles && categoryIndex < categoryQueue.length - 1) {
			truncated = true;
			break;
		}
	}

	return {
		articles,
		truncated
	};
};

const getArticleDetail = async (
	connection: IZohoDeskConnection,
	candidate: IArticleCandidate
): Promise<IZohoArticleDetail> => {
	const params: Record<string, unknown> = {};
	const latestPublishedVersion = stableTextValue(candidate.item.latestPublishedVersion);

	if (latestPublishedVersion) {
		params.version = latestPublishedVersion;
	}

	return zohoDeskRequest<IZohoArticleDetail>(connection, {
		method: "GET",
		path: `/articles/${encodeURIComponent(String(candidate.item.id))}`,
		params
	});
};

const mergeArticleDetail = (candidate: IArticleCandidate, detail: IZohoArticleDetail): IZohoArticleDetail => {
	return {
		...candidate.item,
		...detail,
		id: detail.id || candidate.item.id,
		categoryId: detail.categoryId || (detail.category && detail.category.id) || candidate.item.categoryId || candidate.categoryId,
		latestPublishedVersion: detail.latestPublishedVersion || candidate.item.latestPublishedVersion,
		latestVersion: detail.latestVersion || candidate.item.latestVersion,
		modifiedTime: detail.modifiedTime || candidate.item.modifiedTime,
		permission: detail.permission || candidate.item.permission,
		rootCategoryId: detail.rootCategoryId || candidate.item.rootCategoryId,
		status: detail.status || candidate.item.status,
		summary: detail.summary || candidate.item.summary,
		title: detail.title || candidate.item.title,
		translationId: detail.translationId || candidate.item.translationId
	};
};

const buildArticleText = (article: IZohoArticleDetail): string => {
	const parts = [
		article.title,
		article.summary ? stripHtml(article.summary) : undefined,
		article.category && article.category.name ? `Category: ${article.category.name}` : undefined,
		article.answer ? stripHtml(article.answer) : undefined
	]
		.map((part: string | undefined) => part ? normalizePlainText(part) : "")
		.filter(Boolean);

	return parts.join("\n\n");
};

const buildSourceDescription = (article: IZohoArticleDetail): string => {
	const label = sanitizeDescriptionLabel(article.title || article.articleNumber || article.id || "article");

	return label ? `Zoho Desk article ${label}` : "Zoho Desk article";
};

const buildSourceName = (sourcePrefix: string, scopeLabel: string, article: IZohoArticleDetail): string => {
	const title = normalizePlainText(article.title || article.articleNumber || article.id || "Untitled article");
	return `${sourcePrefix}: ${scopeLabel}: ${title}`;
};

const getContentHashOrTimestamp = (article: IZohoArticleDetail): string => {
	return [
		article.modifiedTime,
		article.latestPublishedVersion,
		article.latestVersion,
		article.translationId
	]
		.map(stableTextValue)
		.filter(Boolean)
		.join("|") || String(article.id || article.articleNumber || "unknown");
};

const buildExternalIdentifier = (scopeKey: string, articleId: string): string => {
	return `zohoDesk:published:${scopeKey}:article:${articleId}`;
};

const metadataValue = (value: unknown): string | undefined => {
	if (value === undefined || value === null || value === "") {
		return undefined;
	}

	return String(value);
};

const buildMetadata = (
	article: IZohoArticleDetail,
	scope: IResolvedScope,
	chunkIndex: number
): Record<string, string | number | boolean> => {
	const metadata: Record<string, string | number | boolean> = {
		articleId: String(article.id || ""),
		chunkIndex,
		source: "zoho-desk",
		scopeKey: scope.scopeKey
	};
	const optionalMetadata: Record<string, unknown> = {
		articleNumber: article.articleNumber,
		categoryId: article.categoryId || (article.category && article.category.id),
		categoryName: article.category && article.category.name,
		latestPublishedVersion: article.latestPublishedVersion,
		latestVersion: article.latestVersion,
		locale: article.locale,
		permission: article.permission,
		portalUrl: article.portalUrl,
		rootCategoryId: article.rootCategoryId || scope.rootCategoryId,
		rootCategoryName: scope.rootCategoryName,
		selectedCategoryId: scope.selectedCategoryId,
		selectedCategoryName: scope.selectedCategoryName,
		status: article.status,
		translationId: article.translationId,
		webUrl: article.webUrl
	};

	Object.keys(optionalMetadata).forEach((key: string) => {
		const value = metadataValue(optionalMetadata[key]);

		if (value) {
			metadata[key] = value;
		}
	});

	return metadata;
};

const isSourceInCurrentScope = (
	source: IKnowledge.KnowledgeSource,
	sourcePrefix: string,
	scope: IResolvedScope
): boolean => {
	const externalIdentifier = source.externalIdentifier || "";
	const sourceName = source.name || "";

	return externalIdentifier.startsWith(`zohoDesk:published:${scope.scopeKey}:article:`)
		|| sourceName.startsWith(`${sourcePrefix}: ${scope.scopeLabel}: `);
};

export const deleteStaleSources = async (
	api: IKnowledge.KnowledgeApi,
	sources: IKnowledge.KnowledgeSource[],
	seenExternalIdentifiers: Set<string>,
	sourcePrefix: string,
	scope: IResolvedScope
): Promise<void> => {
	for (const source of sources) {
		const externalIdentifier = source.externalIdentifier || source.name;

		if (isSourceInCurrentScope(source, sourcePrefix, scope) && !seenExternalIdentifiers.has(externalIdentifier)) {
			await api.deleteKnowledgeSource({
				knowledgeSourceId: source.knowledgeSourceId
			});
		}
	}
};

const errorMessage = (error: unknown): string => {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return String(error || "Unknown error");
};

export const zohoDeskKnowledgeConnector = createKnowledgeConnector({
	type: "zohoDeskKnowledgeConnector",
	label: "Zoho Desk Articles",
	summary: "Import published Zoho Desk help-center articles into Cognigy Knowledge.",
	fields,
	function: async ({ config, sources, api }) => {
		const connection = config.connection as IZohoDeskConnection;
		const sourcePrefix = requiredText(config.knowledgeSourcePrefix || DEFAULT_SOURCE_PREFIX, "Knowledge Source Prefix");
		const maxArticles = integerInRange(config.maxArticles, "Maximum Articles", DEFAULT_MAX_ARTICLES, MIN_MAX_ARTICLES, MAX_MAX_ARTICLES);
		const maxChunkCharacters = integerInRange(
			config.maxChunkCharacters,
			"Maximum Chunk Characters",
			DEFAULT_MAX_CHUNK_CHARACTERS,
			MIN_CHUNK_CHARACTERS,
			MAX_CHUNK_CHARACTERS
		);
		const permission = validatePermission(config.permission);
		const tags = uniqueTags(config.tags);
		const scope = await resolveArticleScope(connection, {
			rootCategoryName: config.rootCategoryName,
			categoryPath: config.categoryPath,
			rootCategoryId: config.rootCategoryId,
			categoryId: config.categoryId,
			includeChildCategories: config.includeChildCategories,
			permission
		});
		const result = await listArticlesForCategories(connection, scope.categoryIds, maxArticles, permission);
		const seenExternalIdentifiers = new Set<string>();

		for (const candidate of result.articles) {
			const detail = await getArticleDetail(connection, candidate);
			const article = mergeArticleDetail(candidate, detail);
			const text = buildArticleText(article);
			const chunks = chunkText(text, maxChunkCharacters);

			if (!article.id || chunks.length === 0) {
				continue;
			}

			const externalIdentifier = buildExternalIdentifier(scope.scopeKey, String(article.id));
			seenExternalIdentifiers.add(externalIdentifier);

			let source: { knowledgeSourceId: string } | null;

			try {
				source = await api.upsertKnowledgeSource({
					name: buildSourceName(sourcePrefix, scope.scopeLabel, article),
					description: buildSourceDescription(article),
					tags,
					chunkCount: chunks.length,
					contentHashOrTimestamp: getContentHashOrTimestamp(article),
					externalIdentifier
				});
			} catch (error) {
				throw new Error(`Failed to upsert Zoho Desk article ${article.id}: ${errorMessage(error)}`);
			}

			if (source === null) {
				continue;
			}

			for (let index = 0; index < chunks.length; index += 1) {
				try {
					await api.createKnowledgeChunk({
						knowledgeSourceId: source.knowledgeSourceId,
						text: chunks[index],
						data: buildMetadata(article, scope, index)
					});
				} catch (error) {
					throw new Error(`Failed to create Zoho Desk article ${article.id} chunk ${index + 1}/${chunks.length}: ${errorMessage(error)}`);
				}
			}
		}

		if (!result.truncated && scope.exhaustive) {
			await deleteStaleSources(api, sources, seenExternalIdentifiers, sourcePrefix, scope);
		}
	}
});
