// api/coach.ts
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { updateProfile } from "firebase/auth";

function buildAliases(
  displayName: string,
  email: string | null,
  extra: string[]
): string[] {
  const list: string[] = [];
  const seen = new Set<string>();
  const add = (s?: string) => {
    const v = s?.trim();
    if (!v) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(v);
  };
  add(displayName);
  add(email || undefined);
  extra.forEach(add);
  return list;
}

/** 确保当前登录用户在 coaches/{uid} 有档案；若不存在则创建 */
export async function ensureCoachProfileForCurrentUser(
  extraAliases: string[] = []
) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");

  const ref = doc(db, "coaches", u.uid);
  const snap = await getDoc(ref);

  const fallbackName = u.email ? u.email.split("@")[0] : "Coach";
  const displayName = u.displayName || snap.data()?.displayName || fallbackName;
  const email = u.email || snap.data()?.email || null;
  const aliases = buildAliases(displayName, email, extraAliases);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: u.uid,
      email,
      displayName,
      aliases,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log("[coach] created coach profile:", u.uid);
  } else {
    // 合并补齐（不覆盖你可能已有的字段，可按需更细化）
    await setDoc(
      ref,
      {
        email,
        displayName,
        aliases,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log("[coach] updated coach profile:", u.uid);
  }

  if (!u.displayName && displayName) {
    await updateProfile(u, { displayName });
    await u.reload();
  }
}

/** 只更新别名（登陆后手动补） */
export async function updateCoachAliasesForCurrentUser(extraAliases: string[]) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");
  const ref = doc(db, "coaches", u.uid);
  const snap = await getDoc(ref);
  const displayName = u.displayName || snap.data()?.displayName || "Coach";
  const email = u.email || snap.data()?.email || null;
  const aliases = buildAliases(displayName, email, extraAliases);

  await setDoc(ref, { aliases, updatedAt: serverTimestamp() }, { merge: true });
  console.log("[coach] aliases updated:", aliases);
}
