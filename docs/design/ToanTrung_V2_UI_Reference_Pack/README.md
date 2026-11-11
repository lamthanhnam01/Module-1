# BO ANH GIAO DIEN MAU - TOAN TRUNG V2

## MUC DICH
Bo nay la ANH THAM KHAO THIET KE (UI reference), KHONG PHAI SOURCE CODE hay bo chuc nang da hoan thanh.
Dua nguyen thu muc `ToanTrung_V2_UI_Reference_Pack` vao project moi (co the dat tai `docs/design/`).

## DANH SACH VA UU TIEN
- `references/01-login/01-login-chot-mau.png`: mau trang dang nhap da duoc chot, uu tien cao nhat.
- `references/02-dashboard/01-dashboard-mang-mau.png`: nhan mau trong card KPI, nen xanh-xam nhat.
- `references/02-dashboard/02-dashboard-toan-trang-demo.png`: cach can khoang cach, sidebar, bieu do, ban chi dung lam bo cuc.
- `references/02-dashboard/04-sidebar-he-thong.png`: menu thong bao, ho so, quan ly tai khoan, thuong hieu, cai dat.
- `references/03-system/`: mau Thong bao, Ho so, Thuong hieu va Cai dat; ca 4 trang thuoc CORE.
- `references/04-other/01-module-trong.png`: chi de khoang trang / empty state cho 5 module.
- `references/04-other/02-phong-cach-dashboard-tham-khao.png`: chi hoc nguyen tac bo cuc; KHONG sao chep logo/nhan Perplexity.
- `references/04-other/03-*`, `04-*`: cac anh DEMO nghiep vu cu, KHONG viet lai bang bieu/logic cho 5 module.
- `references/05-mobile/`: mau xu ly bo cuc mobile.
- `brand/`: logo va anh showroom da co trong bo ma nguon mau truoc. Doi chieu lai voi logo goc cua cong ty truoc khi production.
- `previews/`: HTML tham khao tu ban mau truoc (KHONG phai FE/BE can sao chep).

## QUY TAC CHOT
1. Chi xay UI co dinh cho: Login, Dashboard, Thong bao, Ho so tai khoan, Quan ly tai khoan Admin, Thuong hieu, Cai dat.
2. 5 module `/leads`, `/tracking`, `/ads`, `/reports`, `/design` DUNG O TRANG TRONG. 5 nhom se tu viet FE-BE-DB.
3. Dashboard co the co chi so minh hoa CHI TRONG development, co nhan 'Du lieu minh hoa'; khong su dung trong production.
4. Mau nhan tren 4 card: xanh duong (tong quan), tim (moi), cam/vang (cho phan hoi), xanh la (hoan thanh). Khong lam mau qua dam.
5. Dung logo, anh, theme Toan Trung, khong lay logo hay noi dung tu man hinh tham khao khac.
6. Phien dang nhap, phan quyen, tai lieu nhay cam va API phai co kiem tra bao mat backend, khong chi UI.
7. Cho phep dung fonts ho tro tieng Viet, chon mot cap font va su dung dong nhat; khong lay thong so stack trong anh lam chuan ki thuat.
8. Anh tham khao la bat bien; khong ghi de khi tao giao dien moi.

## BANG MAU GOI Y (THAM KHAO - CHUA PHAI BRAND GUIDELINE CHINH THUC)
- Primary #1553A2
- Primary soft #EFF5FF
- Violet #7846FF, soft #F7F4FF
- Amber #F59E0B, soft #FFFBEB
- Success #0BAF7C, soft #F0FDF7
- Canvas #F5F7FC
- Text #17253F

## KHI GIAO ANTIGRAVITY
Yeu cau no mo 1-2 anh LIEN QUAN truoc moi trang, khong quet het anh sau moi task.
Phan biet: anh da chot / anh demo / anh tham khao phong cach.
