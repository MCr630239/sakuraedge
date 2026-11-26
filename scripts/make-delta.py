#!/usr/bin/env python3
"""生成"文件级增量更新包"：只把新旧两个 zip 里内容不同（CRC/大小不同）的文件打进 delta.zip。
用法: make-delta.py old.zip new.zip out-delta.zip [--json out.json --from 1.0.0 --to 1.0.1]
"""
import sys, json, zipfile, argparse

def root_prefix(zf):
    for n in zf.namelist():
        if n.endswith('.exe') and '/' in n:
            return n[:n.rfind('/') + 1]
    return ''

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('old'); ap.add_argument('new'); ap.add_argument('out')
    ap.add_argument('--json', default='')
    ap.add_argument('--from', dest='frm', default='')
    ap.add_argument('--to', dest='to', default='')
    a = ap.parse_args()

    with zipfile.ZipFile(a.old) as zo, zipfile.ZipFile(a.new) as zn:
        ro, rn = root_prefix(zo), root_prefix(zn)
        oldinfo = {n[len(ro):]: i for n, i in ((n, zo.getinfo(n)) for n in zo.namelist()) if not i.is_dir()}
        changed, same = [], 0
        for n in zn.namelist():
            i = zn.getinfo(n)
            if i.is_dir():
                continue
            rel = n[len(rn):]
            oi = oldinfo.get(rel)
            # Electron 壳每次打包 PE 时间戳都会变，但功能相同：exe 只按大小判定，其余按 CRC+大小
            if oi and (oi.CRC == i.CRC or rel.lower().endswith('.exe')) and oi.file_size == i.file_size:
                same += 1
            else:
                changed.append((n, rel, i))
        total_sz = sum(i.file_size for _, _, i in changed)
        with zipfile.ZipFile(a.out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as out:
            for n, rel, i in changed:
                out.writestr(n, zn.read(n))
        import os
        print('变化文件 %d 个 / 未变 %d 个，原文 %.1f MB，delta zip %.1f MB'
              % (len(changed), same, total_sz / 1048576, os.path.getsize(a.out) / 1048576))
        for _, rel, i in changed:
            print('  *', rel, '%.1f MB' % (i.file_size / 1048576))
        if a.json:
            with open(a.json, 'w') as f:
                json.dump({'from': a.frm, 'to': a.to, 'files': [r for _, r, _ in changed],
                           'count': len(changed), 'size': os.path.getsize(a.out)}, f, ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main()
