import type { DataTree } from "@/src/models/contentTransfer";
import type { ItemAccess } from "@/src/models/getItems";
import type { GetAccessToken } from "@/src/utils/hooks/useAccessToken";

export interface PermissionProblem {
  path: string;
  reason: string;
}

// What the access check found at one path. `null` means the item does not exist there.
type Found = { access: ItemAccess | undefined } | null;

// Shape of the batched access-check response: one alias per path, in the order the paths were sent.
interface AccessCheckBody {
  data?: Record<string, { itemId: string; path: string; access?: ItemAccess } | null>;
  errors?: Array<{ message?: string }>;
}

// "/sitecore/content/home" -> "/sitecore/content". Returns null for the top of the tree.
function parentPath(path: string): string | null {
  const index = path.lastIndexOf("/");
  return index > 0 ? path.slice(0, index) : null;
}

function canWrite(access: ItemAccess | undefined): boolean {
  return access?.canWrite === true;
}

function canCreate(access: ItemAccess | undefined): boolean {
  return access?.canCreate === true;
}

// Reads the access rights of all the given paths in one request to the authoring route.
// Any failure throws, so the caller does not start.
async function fetchAccess(
  getAccessToken: GetAccessToken,
  contextId: string,
  paths: string[],
): Promise<Map<string, Found>> {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/authoring/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ sitecoreContextId: contextId, accessPaths: paths }),
  });

  const body = (await response.json().catch(() => ({}))) as AccessCheckBody & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Checking the destination permissions failed.");
  if (body.errors?.length) throw new Error(body.errors.map((error) => error.message).join("; "));
  if (!body.data) throw new Error("Checking the destination permissions returned no data.");

  const found = new Map<string, Found>();
  paths.forEach((path, index) => {
    const entry = body.data?.[`a${index}`];
    found.set(path, entry ? { access: entry.access } : null);
  });
  return found;
}

// Checks the destination before an install writes to it. For each item in the package the check target is:
// - the item at the same path, if it already exists there (the install writes into it), or
// - otherwise its parent (the install creates the item under it).
// The target needs canWrite and canCreate. All paths are checked in one request.
export async function checkDestinationPermissions(
  getAccessToken: GetAccessToken,
  destinationContextId: string,
  dataTrees: DataTree[],
): Promise<PermissionProblem[]> {
  // Every item path and every parent path, once each, in one request.
  const paths = new Set<string>();
  for (const tree of dataTrees) {
    paths.add(tree.itemPath);
    const parent = parentPath(tree.itemPath);
    if (parent !== null) paths.add(parent);
  }
  if (paths.size === 0) return [];

  const found = await fetchAccess(getAccessToken, destinationContextId, [...paths]);

  const problems: PermissionProblem[] = [];
  for (const tree of dataTrees) {
    const existing = found.get(tree.itemPath);
    if (existing) {
      if (!canWrite(existing.access)) {
        problems.push({ path: tree.itemPath, reason: " missing write access for user" });
      }
      continue;
    }

    const parent = parentPath(tree.itemPath);
    if (parent === null) {
      problems.push({ path: tree.itemPath, reason: "the top of the tree cannot be created" });
      continue;
    }
    const target = found.get(parent);
    if (!target) {
      problems.push({ path: parent, reason: " does not exist or user don't have read access" });
    } else if (!canCreate(target.access)) {
      problems.push({ path: parent, reason: " missing create access for user" });
    }
  }
  return problems;
}
