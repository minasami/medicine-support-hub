openapi: 3.1.0
info:
  title: Api
  version: 0.1.0
  description: Chronic Medicines Support API
servers:
  - url: /api
    description: Base API path
tags:
  - name: health
    description: Health operations
  - name: auth
    description: Authentication
  - name: medicines
    description: Medicine catalog
  - name: requests
    description: Medicine requests
  - name: pharmacy
    description: Pharmacy workflow
  - name: ai
    description: AI/Clinical support
  - name: dashboard
    description: Dashboard aggregates
  - name: admin
    description: Platform administration (users & branches)

paths:
  /auth/login:
    post:
      operationId: authLogin
      tags: [auth]
      summary: Authenticate with username and password
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/LoginInput"
      responses:
        "200":
          description: Authenticated user info
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AuthUser"
        "401":
          description: Invalid credentials

  /auth/logout:
    post:
      operationId: authLogout
      tags: [auth]
      summary: Logout and clear session cookie
      responses:
        "200":
          description: Logged out

  /auth/me:
    get:
      operationId: authMe
      tags: [auth]
      summary: Get current authenticated user
      responses:
        "200":
          description: Current user info
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AuthUser"
        "401":
          description: Not authenticated

  /healthz:
    get:
      operationId: healthCheck
      tags: [health]
      summary: Health check
      responses:
        "200":
          description: Healthy
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/HealthStatus"

  /medicines:
    get:
      operationId: listMedicines
      tags: [medicines]
      summary: List/search medicines
      parameters:
        - name: search
          in: query
          schema:
            type: string
          description: Search term (matches English or Arabic name)
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
      responses:
        "200":
          description: List of medicines
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Medicine"

  /requests:
    get:
      operationId: listRequests
      tags: [requests]
      summary: List medicine requests
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, approved, rejected, preparing, ready, delivered, closed, dispensing, dispensed, packaging, packaged, in_transit, completed]
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        "200":
          description: List of requests
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/MedicineRequest"
    post:
      operationId: createRequest
      tags: [requests]
      summary: Submit a new medicine request
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/MedicineRequestInput"
      responses:
        "201":
          description: Request created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/MedicineRequest"

  /requests/{id}:
    get:
      operationId: getRequest
      tags: [requests]
      summary: Get a medicine request by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Request details
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/MedicineRequest"
        "404":
          description: Not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
    patch:
      operationId: updateRequest
      tags: [requests]
      summary: Update a request (status, notes, pharmacy fields)
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/MedicineRequestUpdate"
      responses:
        "200":
          description: Updated request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/MedicineRequest"

  /requests/{id}/track:
    get:
      operationId: trackRequest
      tags: [requests]
      summary: Public minimal status tracking (no auth required)
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Minimal request status
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/RequestTrackStatus"
        "404":
          description: Not found

  /requests/{id}/prescription:
    post:
      operationId: uploadPrescription
      tags: [requests]
      summary: Upload a prescription image (base64)
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/PrescriptionUpload"
      responses:
        "200":
          description: Updated request with prescription URL
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/MedicineRequest"

  /admin/users:
    get:
      operationId: listAdminUsers
      tags: [admin]
      summary: List all staff users (PLATFORM_ADMIN only)
      responses:
        "200":
          description: List of staff users
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/StaffUser"
    post:
      operationId: createAdminUser
      tags: [admin]
      summary: Create a new staff user (PLATFORM_ADMIN only)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateStaffUser"
      responses:
        "201":
          description: Created user
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/StaffUser"

  /admin/users/{id}:
    patch:
      operationId: updateAdminUser
      tags: [admin]
      summary: Update a staff user (PLATFORM_ADMIN only)
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/UpdateStaffUser"
      responses:
        "200":
          description: Updated user
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/StaffUser"

  /admin/branches:
    get:
      operationId: listAdminBranches
      tags: [admin]
      summary: List all branches (PLATFORM_ADMIN only)
      responses:
        "200":
          description: List of branches
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Branch"
    post:
      operationId: createAdminBranch
      tags: [admin]
      summary: Create a new branch (PLATFORM_ADMIN only)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateBranch"
      responses:
        "201":
          description: Created branch
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Branch"

  /admin/branches/{id}:
    patch:
      operationId: updateAdminBranch
      tags: [admin]
      summary: Update a branch (PLATFORM_ADMIN only)
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/UpdateBranch"
      responses:
        "200":
          description: Updated branch
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Branch"

  /dashboard/summary:
    get:
      operationId: getDashboardSummary
      tags: [dashboard]
      summary: Dashboard aggregate stats
      responses:
        "200":
          description: Summary statistics
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/DashboardSummary"

  /dashboard/recent-activity:
    get:
      operationId: getRecentActivity
      tags: [dashboard]
      summary: Recent request activity feed
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 10
      responses:
        "200":
          description: Recent activity items
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/ActivityItem"

  /ai/extract-medicines:
    post:
      operationId: extractMedicines
      tags: [ai]
      summary: OCR-assisted medicine extraction from prescription image
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ExtractMedicinesInput"
      responses:
        "200":
          description: Extracted medicine names
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ExtractedMedicines"

  /ai/clinical-support:
    post:
      operationId: getClinicalSupport
      tags: [ai]
      summary: Clinical Support Assistant (non-final, decision support only)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ClinicalSupportInput"
      responses:
        "200":
          description: Clinical support response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ClinicalSupportResponse"

components:
  schemas:
    HealthStatus:
      type: object
      properties:
        status:
          type: string
      required: [status]

    ErrorResponse:
      type: object
      properties:
        error:
          type: string
      required: [error]

    Medicine:
      type: object
      properties:
        id:
          type: integer
        name_en:
          type: string
        name_ar:
          type: string
        dosage_form:
          type: string
        strength:
          type: ["string", "null"]
        category:
          type: ["string", "null"]
      required: [id, name_en, name_ar, dosage_form]

    RequestedMedicine:
      type: object
      properties:
        medicine_id:
          type: ["integer", "null"]
        name_en:
          type: string
        name_ar:
          type: ["string", "null"]
        quantity:
          type: integer
        notes:
          type: ["string", "null"]
      required: [name_en, quantity]

    MedicineRequest:
      type: object
      properties:
        id:
          type: integer
        requester_name:
          type: string
        requester_phone:
          type: string
        is_for_relative:
          type: boolean
        patient_name:
          type: ["string", "null"]
        patient_relation:
          type: ["string", "null"]
        medicines:
          type: array
          items:
            $ref: "#/components/schemas/RequestedMedicine"
        prescription_url:
          type: ["string", "null"]
        status:
          type: string
          enum: [pending, approved, rejected, preparing, ready, delivered, closed, dispensing, dispensed, packaging, packaged, in_transit, completed]
        reviewer_notes:
          type: ["string", "null"]
        urgency:
          type: string
          enum: [normal, critical]
        wet_signature_required:
          type: boolean
        employee_department:
          type: ["string", "null"]
        pharmacy_notes:
          type: ["string", "null"]
        batch_serial:
          type: ["string", "null"]
        bin_location:
          type: ["string", "null"]
        package_qr:
          type: ["string", "null"]
        coordinator_notes:
          type: ["string", "null"]
        created_at:
          type: string
        updated_at:
          type: string
      required: [id, requester_name, requester_phone, is_for_relative, medicines, status, urgency, wet_signature_required, created_at, updated_at]

    MedicineRequestInput:
      type: object
      properties:
        requester_name:
          type: string
        requester_phone:
          type: string
        is_for_relative:
          type: boolean
        patient_name:
          type: ["string", "null"]
        patient_relation:
          type: ["string", "null"]
        medicines:
          type: array
          items:
            $ref: "#/components/schemas/RequestedMedicine"
        prescription_url:
          type: ["string", "null"]
        urgency:
          type: string
          enum: [normal, critical]
        wet_signature_required:
          type: boolean
        employee_department:
          type: ["string", "null"]
      required: [requester_name, requester_phone, is_for_relative, medicines]

    MedicineRequestUpdate:
      type: object
      properties:
        status:
          type: string
          enum: [pending, approved, rejected, preparing, ready, delivered, closed, dispensing, dispensed, packaging, packaged, in_transit, completed]
        reviewer_notes:
          type: ["string", "null"]
        pharmacy_notes:
          type: ["string", "null"]
        batch_serial:
          type: ["string", "null"]
        bin_location:
          type: ["string", "null"]
        package_qr:
          type: ["string", "null"]
        coordinator_notes:
          type: ["string", "null"]

    PrescriptionUpload:
      type: object
      properties:
        image_base64:
          type: string
        filename:
          type: string
      required: [image_base64, filename]

    DashboardSummary:
      type: object
      properties:
        total:
          type: integer
        pending:
          type: integer
        approved:
          type: integer
        rejected:
          type: integer
        preparing:
          type: integer
        ready:
          type: integer
        dispensing:
          type: integer
        dispensed:
          type: integer
        packaging:
          type: integer
        packaged:
          type: integer
        in_transit:
          type: integer
        delivered:
          type: integer
        completed:
          type: integer
        closed:
          type: integer
      required: [total, pending, approved, rejected, preparing, ready, dispensing, dispensed, packaging, packaged, in_transit, delivered, completed, closed]

    ActivityItem:
      type: object
      properties:
        id:
          type: integer
        request_id:
          type: integer
        requester_name:
          type: string
        action:
          type: string
        status:
          type: string
        created_at:
          type: string
      required: [id, request_id, requester_name, action, status, created_at]

    ExtractMedicinesInput:
      type: object
      properties:
        image_base64:
          type: string
      required: [image_base64]

    ExtractedMedicines:
      type: object
      properties:
        medicines:
          type: array
          items:
            type: string
        raw_text:
          type: string
      required: [medicines, raw_text]

    ClinicalSupportInput:
      type: object
      properties:
        query:
          type: string
        medicines:
          type: array
          items:
            type: string
        context:
          type: ["string", "null"]
      required: [query]

    ClinicalSupportResponse:
      type: object
      properties:
        response:
          type: string
        disclaimer:
          type: string
        sources:
          type: array
          items:
            type: string
      required: [response, disclaimer]

    LoginInput:
      type: object
      properties:
        username:
          type: string
        password:
          type: string
      required: [username, password]

    AuthUser:
      type: object
      properties:
        id:
          type: integer
        username:
          type: string
        role:
          type: string
          enum: [REVIEWER, PHYSICIAN, PHARMACIST, PHARMACY_ASSISTANT, DELIVERY_MAN, BRANCH_MANAGER, COSMETICIAN, DATA_ENTRY, PLATFORM_ADMIN]
        displayName:
          type: string
        branchId:
          type: ["integer", "null"]
      required: [id, username, role, displayName]

    RequestTrackStatus:
      type: object
      properties:
        id:
          type: integer
        status:
          type: string
        created_at:
          type: string
        updated_at:
          type: string
      required: [id, status, created_at, updated_at]

    StaffUser:
      type: object
      properties:
        id:
          type: integer
        username:
          type: string
        display_name:
          type: string
        role:
          type: string
          enum: [REVIEWER, PHYSICIAN, PHARMACIST, PHARMACY_ASSISTANT, DELIVERY_MAN, BRANCH_MANAGER, COSMETICIAN, DATA_ENTRY, PLATFORM_ADMIN]
        branch_id:
          type: ["integer", "null"]
        active:
          type: boolean
        created_at:
          type: string
      required: [id, username, display_name, role, active, created_at]

    CreateStaffUser:
      type: object
      properties:
        username:
          type: string
        password:
          type: string
        display_name:
          type: string
        role:
          type: string
          enum: [REVIEWER, PHYSICIAN, PHARMACIST, PHARMACY_ASSISTANT, DELIVERY_MAN, BRANCH_MANAGER, COSMETICIAN, DATA_ENTRY, PLATFORM_ADMIN]
        branch_id:
          type: ["integer", "null"]
      required: [username, password, display_name, role]

    UpdateStaffUser:
      type: object
      properties:
        display_name:
          type: string
        role:
          type: string
          enum: [REVIEWER, PHYSICIAN, PHARMACIST, PHARMACY_ASSISTANT, DELIVERY_MAN, BRANCH_MANAGER, COSMETICIAN, DATA_ENTRY, PLATFORM_ADMIN]
        branch_id:
          type: ["integer", "null"]
        active:
          type: boolean
        password:
          type: string

    Branch:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
        name_ar:
          type: ["string", "null"]
        manager_id:
          type: ["integer", "null"]
        created_at:
          type: string
      required: [id, name, created_at]

    CreateBranch:
      type: object
      properties:
        name:
          type: string
        name_ar:
          type: ["string", "null"]
        manager_id:
          type: ["integer", "null"]
      required: [name]

    UpdateBranch:
      type: object
      properties:
        name:
          type: string
        name_ar:
          type: ["string", "null"]
        manager_id:
          type: ["integer", "null"]
