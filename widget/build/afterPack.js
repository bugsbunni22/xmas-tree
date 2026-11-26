// 패키징 뒤 TreeWidget.exe 에 트리 아이콘과 파일 정보를 넣어요.
// (리눅스에서 빌드할 때 wine 없이 하려고 electron-builder 의 rcedit 대신 resedit 을 써요)
const fs = require("fs");
const path = require("path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const ResEdit = await import("resedit");
  const PELibrary = await import("pe-library");
  const { productFilename } = context.packager.appInfo;
  const exe = path.join(context.appOutDir, `${productFilename}.exe`);
  const ico = path.join(__dirname, "icon.ico");
  const version = context.packager.appInfo.version;

  const pe = PELibrary.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = PELibrary.NtExecutableResource.from(pe);
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(ico));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const id = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, lang, iconFile.icons.map((i) => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  if (vi) {
    const [a, b, c] = version.split(".").map(Number);
    vi.setFileVersion(a, b, c, 0, 1033);
    vi.setProductVersion(a, b, c, 0, 1033);
    vi.setStringValues({ lang: 1033, codepage: 1200 }, {
      FileDescription: "Christmas Tree Widget", ProductName: "TreeWidget", CompanyName: "bugsbunni22",
      OriginalFilename: "TreeWidget.exe", InternalName: "TreeWidget", FileVersion: version, ProductVersion: version,
      LegalCopyright: "bugsbunni22"
    });
    vi.outputToResourceEntries(res.entries);
  }
  res.outputResource(pe);
  fs.writeFileSync(exe, Buffer.from(pe.generate()));
  console.log("  • afterPack: 아이콘과 파일 정보 넣음", exe);
};
