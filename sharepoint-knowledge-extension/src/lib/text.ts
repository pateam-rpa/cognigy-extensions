const SUPPORTED_TEXT_EXTENSIONS = [
	".txt",
	".md",
	".markdown",
	".csv",
	".json",
	".html",
	".htm",
	".xml",
	".yml",
	".yaml",
	".log"
];

const getFileExtension = (fileName: string): string => {
	const index = fileName.lastIndexOf(".");
	return index === -1 ? "" : fileName.slice(index).toLowerCase();
};

const decodeHtmlEntity = (entity: string): string => {
	const namedEntities: Record<string, string> = {
		amp: "&",
		apos: "'",
		gt: ">",
		lt: "<",
		nbsp: " ",
		quot: "\""
	};
	const numericMatch = entity.match(/^#(x[a-f0-9]+|\d+)$/i);

	if (numericMatch) {
		const rawValue = numericMatch[1].toLowerCase();
		const codePoint = rawValue.startsWith("x")
			? Number.parseInt(rawValue.slice(1), 16)
			: Number.parseInt(rawValue, 10);

		if (Number.isFinite(codePoint)) {
			return String.fromCodePoint(codePoint);
		}
	}

	return namedEntities[entity.toLowerCase()] || `&${entity};`;
};

const decodeHtmlEntities = (value: string): string => {
	return value.replace(/&([a-z]+|#[0-9]+|#x[a-f0-9]+);/gi, (_match: string, entity: string) => decodeHtmlEntity(entity));
};

const stripHtml = (value: string): string => {
	const textWithoutTags = value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/[ \t]+/g, " ")
		.replace(/\n[ \t]+/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	return decodeHtmlEntities(textWithoutTags);
};

const hardSplit = (text: string, maxCharacters: number): string[] => {
	const chunks: string[] = [];
	let remaining = text.trim();

	while (remaining.length > maxCharacters) {
		let splitIndex = remaining.lastIndexOf(" ", maxCharacters);

		if (splitIndex < Math.floor(maxCharacters * 0.5)) {
			splitIndex = maxCharacters;
		}

		chunks.push(remaining.slice(0, splitIndex).trim());
		remaining = remaining.slice(splitIndex).trim();
	}

	if (remaining) {
		chunks.push(remaining);
	}

	return chunks;
};

export const isSupportedTextFile = (fileName: string): boolean => {
	return SUPPORTED_TEXT_EXTENSIONS.indexOf(getFileExtension(fileName)) !== -1;
};

export const normalizeTextContent = (fileName: string, content: Buffer): string => {
	const extension = getFileExtension(fileName);
	const rawText = content.toString("utf8").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

	if (extension === ".html" || extension === ".htm") {
		return stripHtml(rawText);
	}

	return rawText.trim();
};

export const chunkText = (text: string, maxCharacters: number): string[] => {
	const paragraphs = text
		.replace(/\r\n?/g, "\n")
		.split(/\n{2,}/)
		.map((paragraph: string) => paragraph.trim())
		.filter(Boolean);
	const chunks: string[] = [];
	let currentChunk = "";

	for (const paragraph of paragraphs) {
		if (paragraph.length > maxCharacters) {
			if (currentChunk) {
				chunks.push(currentChunk);
				currentChunk = "";
			}

			chunks.push(...hardSplit(paragraph, maxCharacters));
			continue;
		}

		const nextChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;

		if (nextChunk.length > maxCharacters) {
			if (currentChunk) {
				chunks.push(currentChunk);
			}

			currentChunk = paragraph;
		} else {
			currentChunk = nextChunk;
		}
	}

	if (currentChunk) {
		chunks.push(currentChunk);
	}

	return chunks;
};
