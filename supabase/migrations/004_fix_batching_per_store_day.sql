update public.purchase_requests pr
set store_id = s.id
from public.stores s
where pr.store_id is null
  and pr.store_name = s.name;

create unique index if not exists purchase_requests_store_id_date_batch_idx
on public.purchase_requests(store_id, request_date, batch_no)
where store_id is not null;
