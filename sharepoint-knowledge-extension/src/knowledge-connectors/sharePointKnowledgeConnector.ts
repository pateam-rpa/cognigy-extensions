import { createKnowledgeConnector, IKnowledge } from "@cognigy/extension-tools";

import { IGraphDriveItem, ISharePointConnection, normalizeFolderPath, SharePointGraphClient } from "../lib/graphClient";
import { chunkText, isSupportedTextFile, normalizeTextContent } from "../lib/text";
import { integerInRange, optionalBoolean, requiredText } from "../lib/validation";

const DEFAULT_SOURCE_PREFIX = "SharePoint";
const DEFAULT_MAX_FILES = 50;
const DEFAULT_MAX_CHUNK_CHARACTERS = 3500;
const MIN_MAX_FILES = 1;
const MAX_MAX_FILES = 500;
const MIN_CHUNK_CHARACTERS = 500;
const MAX_CHUNK_CHARACTERS = 12000;

interface ICandidateFile {
	item: IGraphDriveItem;
	path: string;
}

interface IFolderTask {
	itemId?: string;
	path: string;
}

const fields = [
	{
		key: "connection",
		label: "SharePoint Connection",
		type: "connection",
		params: {
			connectionType: "sharepoint-client-credentials",
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
		key: "hostname",
		label: "SharePoint Hostname",
		type: "text",
		description: "Example: contoso.sharepoint.com",
		params: {
			required: true
		}
	},
	{
		key: "sitePath",
		label: "Site Path",
		type: "text",
		description: "Examples: /sites/support for SharePoint sites, /teams/ExampleTeam for Teams-connected sites. Use / for the root site.",
		params: {
			required: true
		}
	},
	{
		key: "folderPath",
		label: "Folder Path",
		type: "text",
		defaultValue: "",
		description: "Path relative to the default document library root. Leave empty for root."
	},
	{
		key: "recursive",
		label: "Include Subfolders",
		type: "toggle",
		defaultValue: true
	},
	{
		key: "maxFiles",
		label: "Maximum Files",
		type: "number",
		defaultValue: DEFAULT_MAX_FILES,
		params: {
			min: MIN_MAX_FILES,
			max: MAX_MAX_FILES
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
		defaultValue: [
			"sharepoint"
		],
		description: "Tags added to each Knowledge Source."
	}
] as const;

const uniqueTags = (value: unknown): string[] => {
	const rawTags = Array.isArray(value) ? value : [];
	const tags: string[] = [];
	const seen = new Set<string>();

	for (const tag of [
		"sharepoint",
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

const buildChildPath = (parentPath: string, childName: string): string => {
	return parentPath ? `${parentPath}/${childName}` : childName;
};

const buildSourceDescription = (candidate: ICandidateFile): string => {
	const fileName = candidate.item.name || candidate.path.split("/").pop() || "document";
	const safeFileName = fileName
		.replace(/[^A-Za-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	return safeFileName
		? `SharePoint document ${safeFileName}`
		: "SharePoint document";
};

const buildSourceName = (sourcePrefix: string, candidate: ICandidateFile): string => `${sourcePrefix}: ${candidate.path}`;

const isSourceInCurrentScope = (
	source: IKnowledge.KnowledgeSource,
	sourcePrefix: string,
	folderPath: string
): boolean => {
	const sourceName = source.name || "";
	const scopePrefix = folderPath ? `${sourcePrefix}: ${folderPath}/` : `${sourcePrefix}: `;

	return sourceName.startsWith(scopePrefix);
};

const getContentHashOrTimestamp = (item: IGraphDriveItem): string => {
	return item.eTag || item.cTag || item.lastModifiedDateTime || String(item.size || item.id);
};

const buildMetadata = (candidate: ICandidateFile, chunkIndex: number): Record<string, string | number | boolean> => {
	const metadata: Record<string, string | number | boolean> = {
		chunkIndex,
		fileName: candidate.item.name,
		path: candidate.path,
		source: "sharepoint"
	};

	if (candidate.item.webUrl) {
		metadata.webUrl = candidate.item.webUrl;
	}

	if (candidate.item.lastModifiedDateTime) {
		metadata.lastModifiedDateTime = candidate.item.lastModifiedDateTime;
	}

	if (candidate.item.size !== undefined) {
		metadata.size = candidate.item.size;
	}

	return metadata;
};

const crawlTextFiles = async (
	client: SharePointGraphClient,
	driveId: string,
	folderPathValue: string,
	recursive: boolean,
	maxFiles: number
): Promise<ICandidateFile[]> => {
	const files: ICandidateFile[] = [];
	const rootPath = normalizeFolderPath(folderPathValue);
	const folders: IFolderTask[] = [
		{
			path: rootPath
		}
	];

	while (folders.length > 0 && files.length < maxFiles) {
		const folder = folders.shift();

		if (!folder) {
			continue;
		}

		const children = folder.itemId
			? await client.listDriveItemChildren(driveId, folder.itemId)
			: await client.listDriveChildrenByPath(driveId, folder.path);

		for (const child of children) {
			const childPath = buildChildPath(folder.path, child.name);

			if (child.file && isSupportedTextFile(child.name)) {
				files.push({
					item: child,
					path: childPath
				});

				if (files.length >= maxFiles) {
					break;
				}
			}

			if (recursive && child.folder) {
				folders.push({
					itemId: child.id,
					path: childPath
				});
			}
		}
	}

	return files;
};

export const deleteStaleSources = async (
	api: IKnowledge.KnowledgeApi,
	sources: IKnowledge.KnowledgeSource[],
	seenExternalIdentifiers: Set<string>,
	sourcePrefix: string,
	folderPath: string
): Promise<void> => {
	for (const source of sources) {
		const externalIdentifier = source.externalIdentifier || source.name;

		if (isSourceInCurrentScope(source, sourcePrefix, folderPath) && !seenExternalIdentifiers.has(externalIdentifier)) {
			await api.deleteKnowledgeSource({
				knowledgeSourceId: source.knowledgeSourceId
			});
		}
	}
};

export const sharePointKnowledgeConnector = createKnowledgeConnector({
	type: "sharePointKnowledgeConnector",
	label: "SharePoint",
	summary: "Import text-first SharePoint document library files into Cognigy Knowledge.",
	fields,
	function: async ({ config, sources, api }) => {
		const client = new SharePointGraphClient(config.connection as ISharePointConnection);
		const hostname = requiredText(config.hostname, "SharePoint Hostname");
		const sitePath = requiredText(config.sitePath, "SharePoint Site Path");
		const sourcePrefix = requiredText(config.knowledgeSourcePrefix || DEFAULT_SOURCE_PREFIX, "Knowledge Source Prefix");
		const folderPath = normalizeFolderPath(config.folderPath);
		const recursive = optionalBoolean(config.recursive, true);
		const maxFiles = integerInRange(config.maxFiles, "Maximum Files", DEFAULT_MAX_FILES, MIN_MAX_FILES, MAX_MAX_FILES);
		const maxChunkCharacters = integerInRange(
			config.maxChunkCharacters,
			"Maximum Chunk Characters",
			DEFAULT_MAX_CHUNK_CHARACTERS,
			MIN_CHUNK_CHARACTERS,
			MAX_CHUNK_CHARACTERS
		);
		const tags = uniqueTags(config.tags);
		const site = await client.resolveSite(hostname, sitePath);
		const drive = await client.getSiteDefaultDrive(site.id);
		const files = await crawlTextFiles(client, drive.id, folderPath, recursive, maxFiles);
		const seenExternalIdentifiers = new Set<string>();

		for (const candidate of files) {
			const externalIdentifier = candidate.item.id;
			const content = await client.downloadDriveItemContent(drive.id, candidate.item.id);
			const text = normalizeTextContent(candidate.item.name, content);
			const chunks = chunkText(text, maxChunkCharacters);

			if (chunks.length === 0) {
				continue;
			}

			seenExternalIdentifiers.add(externalIdentifier);

			const source = await api.upsertKnowledgeSource({
				name: buildSourceName(sourcePrefix, candidate),
				description: buildSourceDescription(candidate),
				tags,
				chunkCount: chunks.length,
				contentHashOrTimestamp: getContentHashOrTimestamp(candidate.item),
				externalIdentifier
			});

			if (source === null) {
				continue;
			}

			for (let index = 0; index < chunks.length; index += 1) {
				await api.createKnowledgeChunk({
					knowledgeSourceId: source.knowledgeSourceId,
					text: chunks[index],
					data: buildMetadata(candidate, index)
				});
			}
		}

		await deleteStaleSources(api, sources, seenExternalIdentifiers, sourcePrefix, folderPath);
	}
});
