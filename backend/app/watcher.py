"""Local replacement for the 'Blob Created' trigger: watch the inbox folder for PDFs."""
from __future__ import annotations

import logging
import queue
import threading
import time
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from .config import settings
from .ingest import process_file, remove_file_record, wait_until_stable

log = logging.getLogger("watcher")


class _Handler(FileSystemEventHandler):
    def __init__(self, q: "queue.Queue[str]") -> None:
        self.q = q

    @staticmethod
    def _is_pdf(p: str) -> bool:
        return p.lower().endswith(".pdf") and not Path(p).name.startswith((".", "~"))

    def on_created(self, event):
        if not event.is_directory and self._is_pdf(event.src_path):
            self.q.put(event.src_path)

    def on_modified(self, event):
        if not event.is_directory and self._is_pdf(event.src_path):
            self.q.put(event.src_path)

    def on_moved(self, event):
        if not event.is_directory:
            if self._is_pdf(event.src_path):
                remove_file_record(event.src_path)
            if self._is_pdf(event.dest_path):
                self.q.put(event.dest_path)

    def on_deleted(self, event):
        if not event.is_directory and self._is_pdf(event.src_path):
            remove_file_record(event.src_path)


class InboxWatcher:
    def __init__(self) -> None:
        self.q: "queue.Queue[str]" = queue.Queue()
        self.observer = Observer()
        self._stop = threading.Event()
        self._worker = threading.Thread(target=self._run, daemon=True, name="inbox-worker")

    def start(self) -> None:
        self.observer.schedule(_Handler(self.q), str(settings.inbox_dir), recursive=True)
        self.observer.start()
        self._worker.start()
        log.info("watching %s", settings.inbox_dir)

    def stop(self) -> None:
        self._stop.set()
        self.observer.stop()
        self.observer.join(timeout=3)

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                first = self.q.get(timeout=0.5)
            except queue.Empty:
                continue
            time.sleep(0.8)  # debounce: editors/copies fire several events per file
            batch = {first}
            while True:
                try:
                    batch.add(self.q.get_nowait())
                except queue.Empty:
                    break
            for p in batch:
                try:
                    if wait_until_stable(Path(p)):
                        process_file(p)
                except Exception:  # noqa: BLE001
                    log.exception("failed to process %s", p)
