# import logging
# import sys
# from pythonjsonlogger import jsonlogger
# from core.config import settings


# def get_logger(name: str) -> logging.Logger:
#     logger = logging.getLogger(name)
#     if logger.handlers:
#         return logger
#     handler = logging.StreamHandler(sys.stdout)
#     formatter = jsonlogger.JsonFormatter("%(asctime)s %(name)s %(levelname)s %(message)s")
#     handler.setFormatter(formatter)
#     logger.addHandler(handler)
#     logger.setLevel(getattr(logging, settings.LOG_LEVEL, logging.INFO))
#     return logger




import logging
import sys
from pythonjsonlogger import jsonlogger
from core.config import settings


class _Utf8JsonFormatter(jsonlogger.JsonFormatter):
    """JsonFormatter avec ensure_ascii=False pour afficher
    les emojis et accents directement (pas \ud83d\ude80 etc.)."""

    def jsonify_log_record(self, log_record):
        import json
        # return json.dumps(log_record, ensure_ascii=False)
        return json.dumps(
            log_record,
            ensure_ascii=False,
            default=str
        )


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    handler = logging.StreamHandler(sys.stdout)
    formatter = _Utf8JsonFormatter("%(asctime)s %(name)s %(levelname)s %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(getattr(logging, settings.LOG_LEVEL, logging.INFO))
    return logger