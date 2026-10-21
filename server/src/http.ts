export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function errorBody(error: HttpError) {
  return { error: { code: error.code, message: error.message, fields: error.fields ?? {} } };
}
