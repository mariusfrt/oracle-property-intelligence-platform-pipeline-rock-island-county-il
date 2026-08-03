import fs from "node:fs/promises";
import path from "node:path";
import { PATHS } from "../config.js";

const PINATA_UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";
const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

export interface IpfsArtifact {
  name: string;
  description: string;
  cid: string;
  bytes: number;
  gatewayUrl: string;
}

export interface IpfsManifest {
  generatedAt: string;
  gateway: string;
  note: string;
  artifacts: IpfsArtifact[];
}

export interface PublishIpfsResult {
  manifestPath: string;
  manifest: IpfsManifest;
}

const ELIGIBLE_ARTIFACTS: Array<{
  filePath: string;
  name: string;
  description: string;
}> = [
  {
    filePath: PATHS.publicParquet,
    name: "parcels_enriched_public.parquet",
    description:
      "Eligible, non-personal enriched parcel dataset for Rock Island County (PII and financial fields excluded).",
  },
  {
    filePath: PATHS.enrichmentRunRecord,
    name: "enrichment-run-record.json",
    description: "Enrichment run provenance record (layer counts, sources, timestamps).",
  },
];

interface PinataUploadResponse {
  data?: {
    cid?: string;
    size?: number | string;
  };
}

async function uploadToPinata(
  filePath: string,
  jwt: string,
): Promise<{ cid: string; bytes: number }> {
  const basename = path.basename(filePath);
  const buffer = await fs.readFile(filePath);
  const fileBytes = buffer.byteLength;

  const form = new FormData();
  form.append("file", new File([new Uint8Array(buffer)], basename));
  form.append("name", basename);
  form.append("network", "public");

  const response = await fetch(PINATA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: form,
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("PINATA_JWT needs Files: Write on the public network");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Pinata upload failed for ${basename} (HTTP ${response.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }

  const json = (await response.json()) as PinataUploadResponse;
  const cid = json.data?.cid;
  if (!cid) {
    throw new Error(`Pinata response for ${basename} did not include data.cid`);
  }

  const sizeRaw = json.data?.size;
  const bytes =
    sizeRaw != null && Number.isFinite(Number(sizeRaw)) ? Number(sizeRaw) : fileBytes;

  return { cid, bytes };
}

/**
 * Upload eligible (non-PII) artifacts to public IPFS via Pinata and write data/ipfs-manifest.json.
 * Requires PINATA_JWT. Never logs the JWT.
 */
export async function publishEligibleArtifactsToIpfs(): Promise<PublishIpfsResult> {
  const jwt = process.env.PINATA_JWT?.trim();
  if (!jwt) {
    throw new Error(
      "PINATA_JWT is missing. Set PINATA_JWT in the environment (Pinata JWT with Files: Write on the public network).",
    );
  }

  for (const artifact of ELIGIBLE_ARTIFACTS) {
    try {
      await fs.access(artifact.filePath);
    } catch {
      throw new Error(
        `Eligible artifact not found: ${artifact.filePath}. Run enrich export-public (and enrich record) first.`,
      );
    }
  }

  const artifacts: IpfsArtifact[] = [];
  for (const artifact of ELIGIBLE_ARTIFACTS) {
    const { cid, bytes } = await uploadToPinata(artifact.filePath, jwt);
    artifacts.push({
      name: artifact.name,
      description: artifact.description,
      cid,
      bytes,
      gatewayUrl: `${IPFS_GATEWAY}${cid}`,
    });
  }

  const manifest: IpfsManifest = {
    generatedAt: new Date().toISOString(),
    gateway: IPFS_GATEWAY,
    note: "Eligible, non-personal artifacts only. Owner names, mailing addresses, tax-bill identity, and financial values are deliberately excluded from public IPFS and served only through the access-gated app.",
    artifacts,
  };

  await fs.mkdir(path.dirname(PATHS.ipfsManifest), { recursive: true });
  await fs.writeFile(PATHS.ipfsManifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log("enrich publish-ipfs: uploaded artifacts");
  console.log("name\tcid");
  for (const a of artifacts) {
    console.log(`${a.name}\t${a.cid}`);
  }
  console.log(`enrich publish-ipfs: wrote ${PATHS.ipfsManifest}`);

  return { manifestPath: PATHS.ipfsManifest, manifest };
}
